import type { API, Logging } from "homebridge";
import Backoff from "backo2";
import { EventEmitter } from "events";
import { readFile, writeFile } from "fs";
import { Manager, Socket } from "socket.io-client";

import type { DCNAConfig } from "./config";
import type { ApiConfig, DeviceDataMessage, InstallationInfo } from "./types";
import { ApiClient } from "./client";
import { DeviceTwin } from "./device";
import { NetworkLogger } from "./logger";
import { PLATFORM_NAME } from "./settings";

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: `https://dkncloudna.com`,
  apiBase: `/api/v1`,
  loginPath: `/auth/login/dknUsa`,
  loggedInPath: `/users/isLoggedIn/dknUsa`,
  refreshPath: `/auth/refreshToken/`,
  installationsPath: `/installations/dknUsa`,
  socketPath: `/devices/socket.io/`,
};

type DeviceControl = {
  installation_id: string;
  mac: string;
};

type InstallationControl = {
  installation_id: string;
};

export class Api extends EventEmitter {
  private config: DCNAConfig & ApiConfig;
  private client: ApiClient;

  private token: string | undefined;
  private refreshToken: string | undefined;
  private authenticated = false;

  private manager: Manager | undefined;
  private usersSocket: Socket | undefined;
  private sockets: Record<string, Socket> = {};

  private installations: InstallationInfo[] = [];
  private devices: Map<string, DeviceTwin> = new Map();

  private reconnecting = false;
  private reconnectionAttempts = 5;
  private backoff = new Backoff({ min: 1000, max: 5000, jitter: 0.5 });

  constructor(
    config: DCNAConfig,
    private homebridge: API,
    private log: Logging
  ) {
    super();
    this.config = { ...DEFAULT_API_CONFIG, ...config };
    this.token = config.token;
    this.refreshToken = config.refreshToken;
    this.client = new ApiClient(this.config, log, this.token);
  }

  public async connect(): Promise<void> {
    this.log.info("Connecting to DKN Cloud NA API");
    this.authenticated = false;

    // try checking for isLoggedIn
    if (this.token) {
      const result = await this.client.isLoggedIn();
      if (result.ok) {
        this.authenticated = true;
      }
    }

    // try refresh and login
    if (!this.authenticated && this.refreshToken) {
      const result = await this.client.refreshToken(this.refreshToken);
      if (result.ok) {
        this.saveTokens(result.value);
        const loginResult = await this.client.isLoggedIn();
        this.authenticated = loginResult.ok;
      }
    }

    // try login with email and password
    if (!this.authenticated && this.config.email && this.config.password) {
      const result = await this.client.login(
        this.config.email,
        this.config.password
      );
      if (result.ok) {
        this.saveTokens(result.value);
        this.authenticated = true;
      }
    }

    if (!this.authenticated) {
      throw Error("Unable to authenticate to DKN Cloud NA API");
    }

    await this.refreshInstallations();

    // successfully connected
    this.reconnecting = false;
    this.backoff.reset();
  }

  private async refreshInstallations(): Promise<void> {
    const result = await this.client.getInstallations();

    if (result.ok) {
      this.installations = result.value;
      this.devices = new Map(
        this.installations.flatMap((install) =>
          install.devices.map((device) => [
            device.mac,
            new DeviceTwin(install._id, device.mac, this, device),
          ])
        )
      );

      this.connectSockets();
    } else {
      // remove all devices
      this.installations = [];
      this.devices.clear();
    }

    this.emit("devices", this.devices.values());
  }

  private connectSockets(): void {
    this.disconnect();

    this.manager = new Manager(this.config.baseUrl, {
      transports: ["polling", "websocket"],
      path: this.config.apiBase + this.config.socketPath,
      extraHeaders: { Authorization: `Bearer ${this.token}` },
    });

    this.usersSocket = this.manager.socket("/users", {});
    const usersLog = new NetworkLogger(this.log, `Socket:users`);
    usersLog.attachLogging(this.usersSocket);

    this.usersSocket
      .on("connect_error", this.onConnectError.bind(this))
      .on("control-deleted-installation", (c: InstallationControl) => {
        usersLog.receive("control-deleted-installation", c);
        this.onDeletedInstallation(c);
      })
      .on("control-deleted-device", (d: DeviceControl) => {
        usersLog.receive("control-deleted-device", d);
        this.onDeleteDevice(d);
      })
      .on("control-new-device", (d: DeviceControl) => {
        usersLog.receive("control-new-device", d);
        this.onNewDevice();
      });

    for (const install of this.installations) {
      const socket = this.manager.socket(`/${install._id}::dknUsa`, {});
      const logger = new NetworkLogger(this.log, `Socket:${install._id}`);
      logger.attachLogging(socket);
      socket.on("connect_error", this.onConnectError.bind(this));

      socket.on("device-data", (message: DeviceDataMessage) => {
        const { mac, data } = message;
        logger.receive(`[${mac}]`, data);
        this.devices.get(mac)?.patch(data);
      });

      this.sockets[install._id] = socket;
    }
  }

  private onDeletedInstallation(control: InstallationControl) {
    // remove from installation
    const remove = this.installations.findIndex(
      (x) => x._id === control.installation_id
    );
    if (remove > -1) {
      this.installations.splice(remove, 1);
    }

    // remove devices
    for (const [key, value] of this.devices) {
      if (value.installation === control.installation_id) {
        this.devices.delete(key);
      }
    }

    // close sockets
    const socket = this.sockets[control.installation_id];
    if (socket) {
      socket.close();
      delete this.sockets[control.installation_id];
    }

    this.emit("devices", this.devices.values());
  }

  private onDeleteDevice(control: DeviceControl) {
    this.devices.delete(control.mac);
    this.emit("devices", this.devices.values());
  }

  private onNewDevice() {
    this.refreshInstallations();
  }

  private onConnectError(err: { type: string; description: number }): void {
    // handle authentication errors
    if (err.description === 401) {
      this.disconnect();
      this.reconnect();
    } else {
      this.log.error("Connection Error", err.type, err.description);
    }
  }

  private disconnect() {
    if (
      Object.values(this.sockets).length ||
      this.usersSocket ||
      this.manager
    ) {
      this.log.info("Disconnecting from DKN Cloud NA API");
    }

    if (this.sockets) {
      Object.values(this.sockets).forEach((socket) => {
        socket.removeAllListeners();
        socket.close();
      });
      this.sockets = {};
    }

    if (this.usersSocket) {
      this.usersSocket.removeAllListeners();
      this.usersSocket.close();
      this.usersSocket = undefined;
    }

    if (this.manager) {
      this.manager.removeAllListeners();
      this.manager.close();
      this.manager = undefined;
    }
  }

  private reconnect() {
    if (this.reconnecting) {
      return;
    }

    if (this.backoff.attempts >= this.reconnectionAttempts) {
      this.backoff.reset();
      this.reconnecting = false;
      return;
    }

    this.reconnecting = true;
    setTimeout(this.connect.bind(this), this.backoff.duration());
  }

  sendMachineEvent(
    installation: string,
    mac: string,
    property: string,
    value: unknown
  ): void {
    const socket = this.sockets[installation];
    const logger = new NetworkLogger(this.log, `Socket:${installation}`);

    if (!socket) {
      logger.error(`Missing socket`);
      return;
    }
    if (!socket.connected) {
      logger.error(`Socket not connected`);
      return;
    }

    const machineEvent = {
      mac,
      property,
      value,
    };
    logger.send(`create-machine-event`, machineEvent);
    socket.emit("create-machine-event", machineEvent);
  }

  private async saveTokens(tokens: {
    token: string;
    refreshToken: string;
  }): Promise<void> {
    this.token = tokens.token;
    this.refreshToken = tokens.refreshToken;
    this.client.token = this.token;

    return new Promise((resolve) => {
      const configPath = this.homebridge.user.configPath();
      readFile(configPath, (_, data) => {
        const config = JSON.parse(data.toString());
        for (const p of config["platforms"]) {
          if (p["platform"] === PLATFORM_NAME) {
            p["token"] = this.token;
            p["refreshToken"] = this.refreshToken;
          }
        }
        this.log.debug("Saving Tokens", {
          token: this.token,
          refreshToken: this.refreshToken,
        });
        writeFile(configPath, JSON.stringify(config, null, 2), () => {
          resolve();
        });
      });
    });
  }
}
