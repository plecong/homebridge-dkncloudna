import { DeviceData, DeviceInfo, DeviceMode, TemperatureUnits } from "./types";
import { EventEmitter } from "events";
import type { ApiSocket } from "./socket";

export class DeviceTwin {
  private emitter = new EventEmitter();
  private data: DeviceData | DeviceInfo;

  constructor(public mac: string, private socket: ApiSocket, data: DeviceInfo) {
    this.data = data;
  }

  patch(data: Partial<DeviceData | DeviceInfo>) {
    this.data = { ...this.data, ...data };

    Object.keys(data).forEach((k) =>
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.emitter.emit("patch", k, data[k])
    );
  }

  addListener(f: (...args: any[]) => any) {
    this.emitter.addListener("patch", f);
  }

  removeListener(f: (...args: any[]) => any) {
    this.emitter.removeListener("patch", f);
  }

  private get device() {
    return this.data as DeviceData;
  }

  get name(): string {
    return this.data.name;
  }

  get power(): boolean {
    return this.device.power === true;
  }

  set power(value: boolean) {
    if (value !== this.power) {
      this.socket.createMachineEvent(this.mac, "power", value);
      this.device.power = value;
    }
  }

  get mode(): DeviceMode {
    return this.device.mode;
  }

  set mode(value: DeviceMode) {
    this.socket.createMachineEvent(this.mac, "mode", value);
    this.device.mode = value;
  }

  get realMode(): DeviceMode {
    return this.device.real_mode;
  }

  get workTemp(): number {
    return (
      this.device.work_temp ||
      (this.device.units === TemperatureUnits.CELSIUS ? 0 : 32)
    );
  }

  get targetTemperature(): number {
    switch (this.mode) {
      case DeviceMode.AUTO:
        return this.device.setpoint_air_auto;
      case DeviceMode.COOL:
        return this.device.setpoint_air_cool;
      case DeviceMode.HEAT:
        return this.device.setpoint_air_heat;
      default:
        return this.device.units === TemperatureUnits.CELSIUS ? 0 : 32;
    }
  }

  set targetTemperature(value: number) {
    switch (this.mode) {
      case DeviceMode.AUTO:
        this.socket.createMachineEvent(this.mac, "setpoint_air_auto", value);
        this.device.setpoint_air_auto = value;
        break;
      case DeviceMode.COOL:
        this.socket.createMachineEvent(this.mac, "setpoint_air_cool", value);
        this.device.setpoint_air_cool = value;
        break;
      case DeviceMode.HEAT:
        this.socket.createMachineEvent(this.mac, "setpoint_air_heat", value);
        this.device.setpoint_air_heat = value;
        break;
    }
  }

  get temperatureUnits(): TemperatureUnits {
    return this.device.units;
  }
}
