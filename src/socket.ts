import type { Logging } from "homebridge";
import type { Socket } from "socket.io-client";
import { DeviceTwin } from "./device";
import type { DeviceDataMessage, InstallationInfo } from "./types";

export class ApiSocket {
  private devices: Record<string, DeviceTwin> = {};

  constructor(
    private data: InstallationInfo,
    private socket: Socket,
    private log: Logging
  ) {
    socket.on("connect", this._onConnect.bind(this));
    socket.on("connect_error", this._onConnectError.bind(this));
    socket.on("device-data", this._onDeviceData.bind(this));
    socket.on("close", this._onClose.bind(this));

    for (const device of this.data.devices) {
      const { mac } = device;
      this.devices[mac] = new DeviceTwin(mac, this, device);
    }
  }

  private _onConnect(): void {
    this.log.debug(`socket ${this.data._id} open`);
  }

  private _onClose(): void {
    this.log.debug(`socket ${this.data._id} close`);
  }

  private _onConnectError(error: unknown): void {
    // TODO: Handle 401 connection error
    this.log.error("connect_error", error);
  }

  private _onDeviceData(message: DeviceDataMessage): void {
    this.log.debug(`device-data`, message);
    const device = this.devices[message.mac];
    if (device) {
      device.patch(message.data);
    }
  }

  createMachineEvent(mac: string, property: string, value: unknown) {
    this.log.debug(`\x1b[32m[Socket]\x1b[0m \x1b[34m⬆\x1b[0m [${mac}]`, {
      property,
      value,
    });
    this.socket.emit("create-machine-event", {
      mac,
      property,
      value,
    });
  }

  getDevices(): Array<DeviceTwin> {
    return Object.values(this.devices);
  }

  close(): void {
    this.socket.close();
  }

  get name(): string {
    return this.data.name;
  }
}
