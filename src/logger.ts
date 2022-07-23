import type { Logging } from "homebridge";

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
}
