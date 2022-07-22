import type {
  CharacteristicValue,
  Logger,
  PlatformAccessory,
  Service,
} from "homebridge";
import type { DeviceTwin } from "./device";
import { hap } from "./hap";
import { DeviceMode, TemperatureUnits } from "./types";

export class DeviceAccessory {
  private service: Service;

  constructor(
    private device: DeviceTwin,
    accessory: PlatformAccessory,
    private log: Logger
  ) {
    const { Characteristic, Service } = hap;

    accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, "Daikin")
      .setCharacteristic(Characteristic.SerialNumber, this.device.mac);

    this.service =
      accessory.getService(Service.Thermostat) ||
      accessory.addService(Service.Thermostat);

    this.service.setCharacteristic(Characteristic.Name, device.name);

    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    this.device.addListener("patch", this.updateCharacteristics.bind(this));
  }

  updateDevice(device: DeviceTwin): void {
    if (this.device) {
      this.device.removeAllListeners();
    }
    this.device = device;
    this.device.addListener("patch", this.updateCharacteristics.bind(this));
  }

  updateCharacteristics(property: string) {
    const { Characteristic } = hap;
    switch (property) {
      case "work_temp":
        this.service.updateCharacteristic(
          Characteristic.CurrentTemperature,
          this.convertGetTemp(this.device.workTemp)
        );
        break;
      case "setpoint_air_auto":
      case "setpoint_air_cool":
      case "setpoint_air_heat":
        this.service.updateCharacteristic(
          Characteristic.TargetTemperature,
          this.convertGetTemp(this.device.targetTemperature)
        );
        break;
      case "real_mode":
      case "mode":
      case "power":
        if (this.device.power === false) {
          this.service.updateCharacteristic(
            Characteristic.CurrentHeatingCoolingState,
            Characteristic.CurrentHeatingCoolingState.OFF
          );
          this.service.updateCharacteristic(
            Characteristic.TargetHeatingCoolingState,
            Characteristic.TargetHeatingCoolingState.OFF
          );
        } else {
          this.service.updateCharacteristic(
            Characteristic.CurrentHeatingCoolingState,
            this.device.realMode === DeviceMode.COOL
              ? Characteristic.CurrentHeatingCoolingState.COOL
              : Characteristic.CurrentHeatingCoolingState.HEAT
          );
          this.service.updateCharacteristic(
            Characteristic.TargetHeatingCoolingState,
            toTargetHeatingCoolingState(this.device.mode)
          );
          this.service.updateCharacteristic(
            Characteristic.TargetTemperature,
            this.convertGetTemp(this.device.targetTemperature)
          );
        }

        break;
    }
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    return this.device.power === false
      ? hap.Characteristic.CurrentHeatingCoolingState.OFF
      : this.device.realMode === DeviceMode.COOL
      ? hap.Characteristic.CurrentHeatingCoolingState.COOL
      : hap.Characteristic.CurrentHeatingCoolingState.HEAT;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const {
      Characteristic: { TargetHeatingCoolingState },
    } = hap;

    if (!this.device.power) {
      return TargetHeatingCoolingState.OFF;
    }

    return toTargetHeatingCoolingState(this.device.mode);
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    const {
      Characteristic: { TargetTemperature, TargetHeatingCoolingState },
    } = hap;

    if (value === TargetHeatingCoolingState.OFF) {
      this.device.power = false;
      return;
    } else {
      this.device.power = true;
    }

    const target = (function (t) {
      switch (t) {
        case TargetHeatingCoolingState.AUTO:
          return DeviceMode.AUTO;
        case TargetHeatingCoolingState.HEAT:
          return DeviceMode.HEAT;
        case TargetHeatingCoolingState.COOL:
          return DeviceMode.COOL;
      }

      return DeviceMode.AUTO;
    })(value);

    if (target) {
      this.device.mode = target;
      this.service.updateCharacteristic(
        TargetTemperature,
        this.convertGetTemp(this.device.targetTemperature)
      );
    }
  }

  async getCurrentTemperature(): Promise<number> {
    const value = this.convertGetTemp(this.device.workTemp);
    this.log.debug(
      `${this.device.name}:getCurrentTemperature`,
      this.device.workTemp,
      value
    );
    return value;
  }

  async getTargetTemperature(): Promise<number> {
    const value = this.convertGetTemp(this.device.targetTemperature);
    this.log.debug(
      `${this.device.name}:getTargetTemperature`,
      this.device.targetTemperature,
      value
    );
    return value;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    this.device.targetTemperature = this.convertSetTemp(value as number);
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    const {
      Characteristic: { TemperatureDisplayUnits },
    } = hap;
    switch (this.device.temperatureUnits) {
      case TemperatureUnits.CELSIUS:
        return TemperatureDisplayUnits.CELSIUS;
      case TemperatureUnits.FAHRENHEIT:
      default:
        return TemperatureDisplayUnits.FAHRENHEIT;
    }
  }

  private convertSetTemp(celsiusValue: number) {
    if (this.device.temperatureUnits === TemperatureUnits.FAHRENHEIT) {
      return toFahrenheit(celsiusValue);
    }

    return celsiusValue;
  }

  private convertGetTemp(value: number) {
    if (this.device.temperatureUnits === TemperatureUnits.FAHRENHEIT) {
      return toCelsius(value);
    }

    return value;
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

function toTargetHeatingCoolingState(mode: DeviceMode) {
  const {
    Characteristic: { TargetHeatingCoolingState },
  } = hap;
  switch (mode) {
    case DeviceMode.AUTO:
      return TargetHeatingCoolingState.AUTO;
    case DeviceMode.HEAT:
      return TargetHeatingCoolingState.HEAT;
    case DeviceMode.COOL:
      return TargetHeatingCoolingState.COOL;
    default:
      return TargetHeatingCoolingState.AUTO;
  }
}
