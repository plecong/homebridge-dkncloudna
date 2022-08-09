import type {
  CharacteristicValue,
  Logging,
  PlatformAccessory,
  Service,
} from "homebridge";
import type { DeviceTwin } from "./device";
import { hap } from "./hap";
import { DeviceMode, TemperatureUnits } from "./types";

export class HeaterCooler {
  private service: Service;

  constructor(
    private device: DeviceTwin,
    accessory: PlatformAccessory,
    log: Logging
  ) {
    const { Characteristic, Service } = hap;
    log.debug("HeaterCooler");

    const accessoryInfo = accessory.getService(Service.AccessoryInformation);
    if (accessoryInfo) {
      accessoryInfo
        .setCharacteristic(Characteristic.Manufacturer, "Daikin")
        .setCharacteristic(Characteristic.SerialNumber, this.device.mac);
    }

    this.service =
      accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler);

    this.service.setCharacteristic(Characteristic.Name, device.name);

    this.service
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    this.service
      .getCharacteristic(Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.service
      .getCharacteristic(Characteristic.SwingMode)
      .onGet(this.getSwingMode.bind(this))
      .onSet(this.setSwingMode.bind(this));

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
    property;
  }

  getActive(): CharacteristicValue {
    const { Characteristic } = hap;
    return this.device.power
      ? Characteristic.Active.ACTIVE
      : Characteristic.Active.INACTIVE;
  }

  setActive(value: CharacteristicValue): void {
    const { Characteristic } = hap;
    this.device.power = value === Characteristic.Active.ACTIVE;
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    const { Characteristic } = hap;
    switch (this.device.realMode) {
      case DeviceMode.HEAT:
        return Characteristic.CurrentHeaterCoolerState.HEATING;
      case DeviceMode.COOL:
        return Characteristic.CurrentHeaterCoolerState.COOLING;
      default:
        return Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    const { Characteristic } = hap;
    switch (this.device.mode) {
      case DeviceMode.HEAT:
        return Characteristic.TargetHeaterCoolerState.HEAT;
      case DeviceMode.COOL:
        return Characteristic.TargetHeaterCoolerState.COOL;
      default:
        return Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  setTargetHeaterCoolerState(value: CharacteristicValue): void {
    const { Characteristic } = hap;
    switch (value) {
      case Characteristic.TargetHeaterCoolerState.HEAT:
        this.device.mode = DeviceMode.HEAT;
        break;
      case Characteristic.TargetHeaterCoolerState.COOL:
        this.device.mode = DeviceMode.COOL;
        break;
      case Characteristic.TargetHeaterCoolerState.AUTO:
        this.device.mode = DeviceMode.AUTO;
        break;
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.currentTemperature;
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    return this.device.coolingTemperature;
  }

  setCoolingThresholdTemperature(value: CharacteristicValue): void {
    this.device.coolingTemperature = value as number;
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    return this.device.heatingTemperature;
  }

  setHeatingThresholdTemperature(value: CharacteristicValue): void {
    this.device.heatingTemperature = value as number;
  }

  getTemperatureDisplayUnits(): CharacteristicValue {
    const { Characteristic } = hap;
    return this.device.temperatureUnits === TemperatureUnits.CELSIUS
      ? Characteristic.TemperatureDisplayUnits.CELSIUS
      : Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
  }

  getRotationSpeed(): CharacteristicValue {
    return this.device.fanSpeed;
  }

  setRotationSpeed(value: CharacteristicValue) {
    this.device.fanSpeed = value as number;
  }

  getSwingMode(): CharacteristicValue {
    const { Characteristic } = hap;
    return this.device.louverEnabled
      ? Characteristic.SwingMode.SWING_ENABLED
      : Characteristic.SwingMode.SWING_DISABLED;
  }

  setSwingMode(value: CharacteristicValue) {
    const { Characteristic } = hap;
    this.device.louverEnabled =
      value === Characteristic.SwingMode.SWING_ENABLED;
  }

  //   updateCharacteristics(property: string) {
  //     const { Characteristic } = hap;
  //     switch (property) {
  //       case "work_temp":
  //         this.service.updateCharacteristic(
  //           Characteristic.CurrentTemperature,
  //           this.device.currentTemperature
  //         );
  //         break;
  //       case "setpoint_air_auto":
  //       case "setpoint_air_cool":
  //       case "setpoint_air_heat":
  //         this.service.updateCharacteristic(
  //           Characteristic.TargetTemperature,
  //           this.device.targetTemperature
  //         );
  //         break;
  //       case "real_mode":
  //       case "mode":
  //       case "power":
  //         if (this.device.power === false) {
  //           this.service.updateCharacteristic(
  //             Characteristic.CurrentHeatingCoolingState,
  //             Characteristic.CurrentHeatingCoolingState.OFF
  //           );
  //           this.service.updateCharacteristic(
  //             Characteristic.TargetHeatingCoolingState,
  //             Characteristic.TargetHeatingCoolingState.OFF
  //           );
  //         } else {
  //           this.service.updateCharacteristic(
  //             Characteristic.CurrentHeatingCoolingState,
  //             this.device.realMode === DeviceMode.COOL
  //               ? Characteristic.CurrentHeatingCoolingState.COOL
  //               : Characteristic.CurrentHeatingCoolingState.HEAT
  //           );
  //           this.service.updateCharacteristic(
  //             Characteristic.TargetHeatingCoolingState,
  //             toTargetHeatingCoolingState(this.device.mode)
  //           );
  //           this.service.updateCharacteristic(
  //             Characteristic.TargetTemperature,
  //             this.device.currentTemperature
  //           );
  //         }

  //         break;
  //     }
  //   }

  //     async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
  //       if (!this.device.power) {
  //         return hap.Characteristic.CurrentHeatingCoolingState.OFF;
  //       }

  //       return this.device.realMode === DeviceMode.COOL
  //         ? hap.Characteristic.CurrentHeatingCoolingState.COOL
  //         : hap.Characteristic.CurrentHeatingCoolingState.HEAT;
  //     }

  //     async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
  //       if (!this.device.power) {
  //         return hap.Characteristic.TargetHeatingCoolingState.OFF;
  //       }

  //       return toTargetHeatingCoolingState(this.device.mode);
  //     }

  //     async setTargetHeatingCoolingState(value: CharacteristicValue) {
  //       this.log.debug("Setting TargetHeatingCoolingState", value);
  //       const {
  //         Characteristic: { TargetTemperature, TargetHeatingCoolingState },
  //       } = hap;

  //       if (value === TargetHeatingCoolingState.OFF) {
  //         this.device.power = false;
  //         return;
  //       }

  //       this.device.power = true;
  //       this.device.mode = toDeviceMode(value);
  //       this.service.updateCharacteristic(
  //         TargetTemperature,
  //         this.device.targetTemperature
  //       );
  //     }

  //     async getCurrentTemperature(): Promise<number> {
  //       return this.device.currentTemperature;
  //     }

  //     async getTargetTemperature(): Promise<number> {
  //       return this.device.targetTemperature;
  //     }

  //     async setTargetTemperature(value: CharacteristicValue) {
  //       this.log.debug("Setting TargetTemperature", value);
  //       this.device.targetTemperature = value as number;
  //     }

  //     async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
  //       const {
  //         Characteristic: { TemperatureDisplayUnits },
  //       } = hap;
  //       switch (this.device.temperatureUnits) {
  //         case TemperatureUnits.CELSIUS:
  //           return TemperatureDisplayUnits.CELSIUS;
  //         case TemperatureUnits.FAHRENHEIT:
  //         default:
  //           return TemperatureDisplayUnits.FAHRENHEIT;
  //       }
  //     }
  //   }
}
