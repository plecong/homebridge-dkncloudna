import type { Logging } from "homebridge";
import fetch, { RequestInit } from "node-fetch";
import type { ApiConfig, DknLogin, DknToken, InstallationInfo } from "./types";
import { URL } from "url";
import { NetworkLogger } from "./logger";

type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
type RequestHeaders = Record<string, string>; // RequestInit["headers"];

const USER_AGENT = `Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`;
const DEFAULT_HEADERS: RequestHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": USER_AGENT,
};

export class ApiClient {
  private log: NetworkLogger;

  constructor(
    private config: ApiConfig,
    log: Logging,
    public token: string | undefined
  ) {
    this.log = new NetworkLogger(log, "Fetch");
  }

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
    this.log.send(
      `Request: ${options.method} ${url} ${
        body ? ` body=${JSON.stringify(body, _obfuscate)}` : ""
      }`
    );

    const response = await fetch(url, options);
    let data = undefined;
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }
    this.log.receive(
      `Response: (${response.status}: ${response.statusText})`,
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
