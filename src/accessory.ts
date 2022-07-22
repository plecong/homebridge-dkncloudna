import type {
  CharacteristicValue,
  Logging,
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
    private log: Logging
  ) {
    const { Characteristic, Service } = hap;

    const accessoryInfo = accessory.getService(Service.AccessoryInformation);
    if (accessoryInfo) {
      accessoryInfo
        .setCharacteristic(Characteristic.Manufacturer, "Daikin")
        .setCharacteristic(Characteristic.SerialNumber, this.device.mac);
    }

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
          this.device.currentTemperature
        );
        break;
      case "setpoint_air_auto":
      case "setpoint_air_cool":
      case "setpoint_air_heat":
        this.service.updateCharacteristic(
          Characteristic.TargetTemperature,
          this.device.targetTemperature
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
            this.device.currentTemperature
          );
        }

        break;
    }
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    if (!this.device.power) {
      return hap.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    return this.device.realMode === DeviceMode.COOL
      ? hap.Characteristic.CurrentHeatingCoolingState.COOL
      : hap.Characteristic.CurrentHeatingCoolingState.HEAT;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    if (!this.device.power) {
      return hap.Characteristic.TargetHeatingCoolingState.OFF;
    }

    return toTargetHeatingCoolingState(this.device.mode);
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    this.log.debug("Setting TargetHeatingCoolingState", value);
    const {
      Characteristic: { TargetTemperature, TargetHeatingCoolingState },
    } = hap;

    if (value === TargetHeatingCoolingState.OFF) {
      this.device.power = false;
      return;
    }

    this.device.power = true;
    this.device.mode = toDeviceMode(value);
    this.service.updateCharacteristic(
      TargetTemperature,
      this.device.targetTemperature
    );
  }

  async getCurrentTemperature(): Promise<number> {
    return this.device.currentTemperature;
  }

  async getTargetTemperature(): Promise<number> {
    return this.device.targetTemperature;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    this.log.debug("Setting TargetTemperature", value);
    this.device.targetTemperature = value as number;
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
}

function toDeviceMode(value: CharacteristicValue): DeviceMode {
  const {
    Characteristic: { TargetHeatingCoolingState },
  } = hap;
  switch (value) {
    case TargetHeatingCoolingState.AUTO:
      return DeviceMode.AUTO;
    case TargetHeatingCoolingState.HEAT:
      return DeviceMode.HEAT;
    case TargetHeatingCoolingState.COOL:
      return DeviceMode.COOL;
  }

  return DeviceMode.AUTO;
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
