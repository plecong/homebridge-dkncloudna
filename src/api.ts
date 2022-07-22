import type { API, Logging } from "homebridge";
import fetch, { RequestInit } from "node-fetch";
import type { DCNAConfig } from "./config";
import { DeviceTwin } from "./device";
import type {
  ApiConfig,
  DeviceDataMessage,
  DknLogin,
  DknToken,
  InstallationInfo,
} from "./types";
import { Manager, Socket } from "socket.io-client";
import { URL } from "url";

import { EventEmitter } from "events";
import { readFile, writeFile } from "fs";
import { PLATFORM_NAME } from "./settings";
import Backoff from "backo2";

const USER_AGENT = `Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`;

type RequestHeaders = Record<string, string>; // RequestInit["headers"];

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: `https://dkncloudna.com`,
  apiBase: `/api/v1`,
  loginPath: `/auth/login/dknUsa`,
  loggedInPath: `/users/isLoggedIn/dknUsa`,
  refreshPath: `/auth/refreshToken/`,
  installationsPath: `/installations/dknUsa`,
  socketPath: `/devices/socket.io/`,
};

const DEFAULT_HEADERS: RequestHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": USER_AGENT,
};

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export class Api extends EventEmitter {
  private config: DCNAConfig & ApiConfig;
  private client: ApiClient;

  private token: string | undefined;
  private refreshToken: string | undefined;
  private authenticated = false;

  private manager: Manager | undefined;
  private installations: InstallationInfo[] = [];
  private readonly sockets: Record<string, Socket> = {};
  private devices: Record<string, DeviceTwin> = {};

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
    this.reconnecting = false;
  }

  private async refreshInstallations(): Promise<void> {
    const result = await this.client.getInstallations();
    if (result.ok) {
      this.installations = result.value;
      this.clearDevices();

      for (const install of this.installations) {
        for (const device of install.devices) {
          this.devices[device.mac] = new DeviceTwin(
            install._id,
            device.mac,
            this,
            device
          );
        }
      }

      this.emit("devices", Object.values(this.devices));
      this.connectSockets();
    } else {
      // remove all devices
      this.installations = [];
      this.clearDevices();
      this.emit("devices", []);
    }
  }

  private clearDevices() {
    // clean-up devices
    Object.values(this.devices).forEach((device) =>
      device.removeAllListeners()
    );
    this.devices = {};
  }

  private connectSockets(): void {
    this.manager = new Manager(this.config.baseUrl, {
      transports: ["polling"], // "websocket"],
      path: this.config.apiBase + this.config.socketPath,
      extraHeaders: { Authorization: `Bearer ${this.token}` },
      autoConnect: false,
    });

    this.manager.on("ping", () => {
      this.log.debug("PING");
    });

    for (const install of this.installations) {
      const socket = this.manager.socket(`/${install._id}::dknUsa`, {});
      socket.on("device-data", this.onDeviceData.bind(this));

      socket.on("connect", () => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[34mConnected\x1b[0m`
        );
      });

      socket.on(
        "connect_error",
        (err: { type: string; description: string | number }) => {
          this.log.debug(
            `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mConnection Error\x1b[0m`,
            err.type,
            err.description
          );
          // handle authentication errors
          if (err.description === 401) {
            this.disconnect();
            this.reconnect();
          }
        }
      );

      socket.on("connect_timeout", (timeout: unknown) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mTimeout\x1b[0m`,
          timeout
        );
      });

      socket.on("reconnecting", (attempt: unknown) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mReconnecting\x1b[0m`,
          attempt
        );
      });

      socket.on("reconnect", (attempt: unknown) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[34mReconnected\x1b[0m`,
          attempt
        );
      });

      socket.on("reconnect_error", (error: unknown) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mReconnect Error\x1b[0m`,
          error
        );
      });

      socket.on("reconnect_failed", () => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mReconnect Failed\x1b[0m`
        );
      });

      socket.on("disconnect", (reason: string) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mDisconnected\x1b[0m`,
          reason
        );
      });

      socket.on("error", (error: unknown) => {
        this.log.debug(
          `\x1b[32m[Socket:${install._id}]\x1b[0m \x1b[31mError\x1b[0m`,
          error
        );
      });

      socket.open();
      this.sockets[install._id] = socket;
    }
  }

  private reconnecting = false;
  private reconnectionAttempts = 5;
  private backoff = new Backoff({ min: 1000, max: 5000, jitter: 0.5 });

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

  onDeviceData(message: DeviceDataMessage): void {
    this.log.debug(
      `\x1b[32m[Device:${message.mac}]\x1b[0m \x1b[31m⬇\x1b[0m `,
      message.data
    );
    const device = this.devices[message.mac];
    if (device) {
      device.patch(message.data);
    }
  }

  sendMachineEvent(
    installation: string,
    mac: string,
    property: string,
    value: unknown
  ): void {
    const socket = this.sockets[installation];
    if (!socket) {
      this.log.error(`Missing socket ${installation}`);
      return;
    }
    if (!socket.connected) {
      this.log.error(`Socket not connected ${installation}`);
      return;
    }

    const machineEvent = {
      mac,
      property,
      value,
    };
    this.log.debug(
      `\x1b[32m[Socket:${installation}]\x1b[0m \x1b[34m⬆\x1b[0m `,
      machineEvent
    );
    socket.emit("create-machine-event", machineEvent);
  }

  private disconnect() {
    this.log.debug("Disconnecting");

    if (this.sockets) {
      Object.values(this.sockets).forEach((socket) => {
        socket.removeAllListeners();
        socket.close();
      });
    }

    if (this.manager) {
      this.manager.removeAllListeners();
      this.manager.close();
      this.manager = undefined;
    }
  }

  private async saveTokens(tokens: {
    token: string;
    refreshToken: string;
  }): Promise<void> {
    this.token = tokens.token;
    this.refreshToken = tokens.refreshToken;

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

class ApiClient {
  constructor(
    private config: ApiConfig,
    private log: Logging,
    public token: string | undefined
  ) {}

  public async login(
    email: string,
    password: string
  ): Promise<Result<DknLogin>> {
    return await this._request(this.getUrl(this.config.loginPath), {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: this.getHeaders(),
    });
  }

  public async isLoggedIn(): Promise<Result<DknLogin>> {
    return await this._request(this.getUrl(this.config.loggedInPath), {
      method: "GET",
      headers: this.getHeaders(true),
    });
  }

  public async refreshToken(refreshToken: string): Promise<Result<DknToken>> {
    if (!refreshToken) {
      return Promise.resolve({
        ok: false,
        error: Error("Missing refresh token"),
      });
    }

    return await this._request(
      this.getUrl(this.config.refreshPath + refreshToken + "/dknUsa"),
      {
        method: "GET",
        headers: this.getHeaders(true),
      }
    );
  }

  public async getInstallations(): Promise<Result<InstallationInfo[]>> {
    return await this._request(this.getUrl(this.config.installationsPath), {
      method: "GET",
      headers: this.getHeaders(true),
    });
  }

  private getUrl(path: string): URL {
    return new URL(`${this.config.apiBase}${path}`, this.config.baseUrl);
  }

  private getHeaders(auth = false): RequestHeaders {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async _request<T>(
    url: URL,
    options: RequestInit
  ): Promise<Result<T>> {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    this.log.debug(
      `\x1b[32m[Fetch]\x1b[0m \x1b[34m⬆\x1b[0m \x1b[33mRequest: ${options.method} ${url}` +
        `${body ? ` body=${JSON.stringify(body, _obfuscate)}` : ""}\x1b[0m`
    );
    const response = await fetch(url, options);

    let data = undefined;
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }
    this.log.debug(
      `\x1b[32m[Fetch]\x1b[0m \x1b[31m⬇\x1b[0m \x1b[33mResponse: (${response.status}: ${response.statusText})\x1b[0m`,
      data
    );

    if (response.ok) {
      return { ok: true, value: data };
    } else {
      return { ok: false, error: Error(response.statusText) };
    }
  }
}

function _obfuscate(key: string, value: unknown): unknown {
  if (key === "password" && typeof value === "string") {
    return value.replace(/./g, "*");
  }
  return value;
}
