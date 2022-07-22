import { DeviceData, DeviceInfo, DeviceMode, TemperatureUnits } from "./types";
import { EventEmitter } from "events";
import type { Api } from "./api";

const EVENT_PROPERTIES = [
  "work_temp",
  "setpoint_air_auto",
  "setpoint_air_cool",
  "setpoint_air_heat",
  "real_mode",
  "mode",
  "power",
];

export class DeviceTwin extends EventEmitter {
  private data: DeviceData | DeviceInfo;

  constructor(
    public installation: string,
    public mac: string,
    private api: Api,
    data: DeviceData | DeviceInfo
  ) {
    super();
    this.data = data;
  }

  patch(data: Partial<DeviceData>) {
    this.data = { ...this.data, ...data };

    Object.keys(data).forEach((key) => {
      if (EVENT_PROPERTIES.includes(key)) {
        this.emit("patch", key, data[key]);
      }
    });
  }

  private get device() {
    return this.data as DeviceData;
  }

  get key(): string {
    return `${this.installation}:${this.mac}`;
  }

  get name(): string {
    return this.data.name;
  }

  get power(): boolean {
    return this.device.power === true;
  }

  set power(value: boolean) {
    if (value !== this.power) {
      this.sendEvent("power", value);
      this.device.power = value;
    }
  }

  get mode(): DeviceMode {
    return this.device.mode;
  }

  set mode(value: DeviceMode) {
    this.sendEvent("mode", value);
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
        this.sendEvent("setpoint_air_auto", value);
        this.device.setpoint_air_auto = value;
        break;
      case DeviceMode.COOL:
        this.sendEvent("setpoint_air_cool", value);
        this.device.setpoint_air_cool = value;
        break;
      case DeviceMode.HEAT:
        this.sendEvent("setpoint_air_heat", value);
        this.device.setpoint_air_heat = value;
        break;
    }
  }

  get temperatureUnits(): TemperatureUnits {
    return this.device.units;
  }

  private sendEvent(property: string, value: unknown): void {
    this.api.sendMachineEvent(this.installation, this.mac, property, value);
  }
}
