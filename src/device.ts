import {
  DeviceData,
  DeviceInfo,
  DeviceMode,
  SpeedState,
  TemperatureUnits,
} from "./types";
import { EventEmitter } from "events";
import type { Api } from "./api";

const EVENT_PROPERTIES = [
  "ext_temp",
  "work_temp",
  "setpoint_air_auto",
  "setpoint_air_cool",
  "setpoint_air_heat",
  "real_mode",
  "mode",
  "power",
  "slats_vertical_1",
  "speed_state",
];

export const FAN_SPEED_AUTO = 50;

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

  get currentTemperature(): number {
    let value = this.device.work_temp;

    if (value === undefined) {
      value = this.getDefaultTargetTemperature();
    }

    return this.getOutputTemperature(value);
  }

  get setpointTemperature(): number {
    switch (this.mode) {
      case DeviceMode.AUTO:
        return this.device.setpoint_air_auto;
      case DeviceMode.COOL:
        return this.device.setpoint_air_cool;
      case DeviceMode.HEAT:
        return this.device.setpoint_air_heat;
      default:
        return this.getDefaultTargetTemperature();
    }
  }

  get coolingTemperature(): number {
    const value =
      this.device.setpoint_air_cool || this.getDefaultTargetTemperature();
    return this.getOutputTemperature(value);
  }

  set coolingTemperature(celsiusValue: number) {
    const value =
      this.device.units === TemperatureUnits.CELSIUS
        ? celsiusValue
        : toFahrenheit(celsiusValue);

    this.sendEvent("setpoint_air_cool", value);
  }

  get heatingTemperature(): number {
    const value =
      this.device.setpoint_air_heat || this.getDefaultTargetTemperature();
    return this.getOutputTemperature(value);
  }

  set heatingTemperature(celsiusValue: number) {
    const value =
      this.device.units === TemperatureUnits.CELSIUS
        ? celsiusValue
        : toFahrenheit(celsiusValue);

    this.sendEvent("setpoint_air_heat", value);
  }

  get targetTemperature(): number {
    const value = this.setpointTemperature;
    return this.getOutputTemperature(value);
  }

  set targetTemperature(celsiusValue: number) {
    const value =
      this.device.units === TemperatureUnits.CELSIUS
        ? celsiusValue
        : toFahrenheit(celsiusValue);

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

  get exteriorTemperature(): number {
    let value = this.device.ext_temp;

    if (value === undefined) {
      value = this.getDefaultTargetTemperature();
    }

    return this.getOutputTemperature(value);
  }

  get louverEnabled(): boolean {
    return this.device.slats_vertical_1 === 9;
  }

  set louverEnabled(enabled: boolean) {
    const value = enabled ? 9 : 0;
    this.sendEvent("slats_vertical_1", value);
    this.device.slats_vertical_1 = value;
  }

  get fanSpeed(): number {
    switch (this.device.speed_state) {
      case 0:
        return FAN_SPEED_AUTO;
      case 2:
        return 20;
      case 3:
        return 40;
      case 4:
        return 60;
      case 5:
        return 80;
      case 6:
        return 100;
      default:
        return 50;
    }
  }

  set fanSpeed(pct: number) {
    let value: SpeedState;
    if (pct === FAN_SPEED_AUTO) {
      value = 0;
    } else {
      value = (Math.round(pct / 20) + 1) as SpeedState;
    }
    this.device.speed_state = value;
    this.sendEvent("speed_state", value);
  }

  private getOutputTemperature(value = 0): number {
    return this.device.units === TemperatureUnits.CELSIUS
      ? value
      : toCelsius(value);
  }

  private getDefaultTargetTemperature(): number {
    return this.device.units === TemperatureUnits.CELSIUS ? 22.2 : 72;
  }

  private sendEvent(property: string, value: unknown): void {
    this.api.sendMachineEvent(this.installation, this.mac, property, value);
  }
}

function toFahrenheit(temperature: number): number {
  // Convert from Celsius to Fahrenheit
  const fahrenheit = (temperature * 9) / 5 + 32;
  return Math.round(fahrenheit);
}

function toCelsius(temperature: number): number {
  // Convert from Fahrenheit to Celsius
  const celsius = ((temperature - 32) * 5) / 9;
  return Math.round(celsius * 10) / 10;
}
