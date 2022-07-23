import type { Logging } from "homebridge";
import type { Socket } from "socket.io-client";

export class NetworkLogger {
  private static enabled = true;

  constructor(private readonly log: Logging, private context: string) {}

  send(message: string, ...args: unknown[]) {
    if (!NetworkLogger.enabled) return;

    this.log.debug(
      `\x1b[32m[${this.context}]\x1b[0m \x1b[34m⬆\x1b[0m \x1b[33m${message}\x1b[0m`,
      ...args
    );
  }

  receive(message: string, ...args: unknown[]) {
    if (!NetworkLogger.enabled) return;

    this.log.debug(
      `\x1b[32m[${this.context}]\x1b[0m \x1b[31m⬇\x1b[0m  \x1b[33m${message}\x1b[0m`,
      ...args
    );
  }

  status(message: string, ...args: unknown[]) {
    if (!NetworkLogger.enabled) return;

    this.log.debug(
      `\x1b[32m[${this.context}]\x1b[0m \x1b[34m${message}\x1b[0m`,
      ...args
    );
  }

  error(message: string, ...args: unknown[]) {
    if (!NetworkLogger.enabled) return;

    this.log.debug(
      `\x1b[32m[${this.context}]\x1b[0m \x1b[31m${message}\x1b[0m`,
      ...args
    );
  }

  attachLogging(socket: Socket) {
    socket.on("connect", () => {
      this.status("Connected");
    });
    socket.on("connect_timeout", (timeout: number) => {
      this.error("Connection Timeout", timeout);
    });
    socket.on("reconnecting", (attempt: number) => {
      this.error("Reconnecting", `attempt=${attempt}`);
    });
    socket.on("reconnect", (attempt: number) => {
      this.status("Reconnected", `attempt=${attempt}`);
    });
    socket.on("reconnect_error", (error: unknown) => {
      this.error("Reconnect Error", error);
    });
    socket.on("reconnect_failed", () => {
      this.error("Reconnect Failed");
    });
    socket.on("disconnect", (reason: string) => {
      this.status("Disconnected", `reason=${reason}`);
    });
    socket.on("error", (error: unknown) => {
      this.error("Error", error);
    });
  }
}
