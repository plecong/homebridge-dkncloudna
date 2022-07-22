import type { Logging } from "homebridge";
import fetch, { RequestInit } from "node-fetch";
import type { DCNAConfig } from "./config";
import type { DeviceTwin } from "./device";
import type { ApiConfig, DknLogin, InstallationInfo } from "./types";
import { Manager } from "socket.io-client";
import { URL } from "url";
import { ApiSocket } from "./socket";

const BASE_URL = "https://dkncloudna.com";
const API_BASE = "/api/v1";
const API_LOGIN = `/auth/login/dknUsa`;
const API_INSTALLATIONS = `/installations/dknUsa`;
const SOCKET_PATH = "/devices/socket.io/";

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: BASE_URL,
  apiBase: API_BASE,
  loginPath: API_LOGIN,
  installationsPath: API_INSTALLATIONS,
  socketPath: SOCKET_PATH,
};

export class Api {
  private config: DCNAConfig & ApiConfig;
  private token: string | undefined;
  private refreshToken: string | undefined;
  private sockets: ApiSocket[] = [];

  constructor(config: DCNAConfig, private log: Logging) {
    this.config = { ...DEFAULT_API_CONFIG, ...config };
    this.token = config.token;
    this.refreshToken = config.refreshToken;
  }

  async connect(): Promise<void> {
    const { email, password } = this.config;

    if (this.token && this.refreshToken) {
      // TODO: check the "loggedIn" endpoint with token before logging in
    }

    const login = await this._request<DknLogin>("POST", this.config.loginPath, {
      email,
      password,
    });

    // TODO: save the token information into the homebridge config
    // save the token
    this.token = login.token;
    this.refreshToken = login.refreshToken;

    // retrieve the installations
    const installations = await this._request<InstallationInfo[]>(
      "GET",
      this.config.installationsPath
    );

    // connect to socket
    const manager = new Manager(this.config.baseUrl, {
      transports: ["websocket"],
      path: this.config.apiBase + this.config.socketPath,
      extraHeaders: { Authorization: `Bearer ${this.token}` },
    });

    // connect socket for each installation
    this.sockets = installations.map(
      (install) =>
        new ApiSocket(
          install,
          manager.socket(`/${install._id}::dknUsa`, {}),
          this.log
        )
    );
  }

  getDevices(): DeviceTwin[] {
    return this.sockets.reduce(
      (all, item) => [...all, ...item.getDevices()],
      [] as DeviceTwin[]
    );
  }

  private async _request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${this.config.apiBase}${path}`);
    const headers: RequestInit["headers"] = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile",
    };
    let data;

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options["body"] = JSON.stringify(body);
    }

    this.log.debug(
      `\x1b[32m[Fetch]\x1b[0m \x1b[34m⬆\x1b[0m \x1b[33mRequest: ${method} ${url}` +
        `${body ? ` body=${JSON.stringify(body, this._obfuscate)}` : ""}\x1b[0m`
    );

    const response = await fetch(url, options);

    if (response && response.ok) {
      this.log.debug(
        `\x1b[32m[Fetch]\x1b[0m \x1b[31m⬇\x1b[0m \x1b[33mStatus: ${response.status}\x1b[0m`
      );
      if (response.status !== 204) {
        const data = await response.json();
        this.log.debug(
          `\x1b[32m[Fetch]\x1b[0m \x1b[31m⬇\x1b[0m \x1b[33mResponse: \x1b[0m`,
          data
        );
        return data;
      }
    } else {
      // TODO refresh the token and retry
      data = await response.json();
      this.log.error(
        `Error calling to AirzoneCloud. Status: ${response.status} ${response.statusText} ` +
          `${
            response.status === 400 ? ` Response: ${JSON.stringify(data)}` : ""
          }`
      );
    }
    return data;
  }

  private _obfuscate(key: string, value: string): string {
    if (key === "password" && typeof value === "string") {
      return value.replace(/./g, "*");
    }
    return value;
  }
}
