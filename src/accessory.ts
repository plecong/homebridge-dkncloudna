import type {
  CharacteristicValue,
  Logging,
  PlatformAccessory,
  Service,
  WithUUID,
} from "homebridge";
import { DeviceTwin, FAN_SPEED_AUTO } from "./device";
import { hap } from "./hap";
import { DeviceMode, TemperatureUnits } from "./types";

type ServiceType = WithUUID<typeof Service> | Service;

function isServiceInstance(
  serviceType: WithUUID<typeof Service> | Service
): serviceType is Service {
  return typeof (serviceType as unknown) === "object";
}

export class DeviceAccessory {
  private thermostat: Service;
  private fan: Service | undefined;
  private exteriorSensor: Service | undefined;
  private servicesInUse: Set<Service> = new Set();

  constructor(
    private device: DeviceTwin,
    private accessory: PlatformAccessory,
    private log: Logging,
    enableFan = true,
    enableExterior = false
  ) {
    const { Characteristic, Service } = hap;

    this.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "Daikin")
      .setCharacteristic(Characteristic.SerialNumber, this.device.mac);

    this.thermostat = this.getService(Service.Thermostat, this.device.name);

    this.thermostat
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.thermostat
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    this.thermostat
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.thermostat
      .getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.thermostat
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    if (enableExterior) {
      this.exteriorSensor = this.getService(
        Service.TemperatureSensor,
        `${device.name} Exterior`
      );
      this.exteriorSensor
        .getCharacteristic(Characteristic.CurrentTemperature)
        .onGet(this.getExteriorCurrentTemperature.bind(this));
    }

    if (enableFan) {
      this.fan = this.getService(Service.Fanv2, `${device.name} Fan`);

      this.fan
        .getCharacteristic(Characteristic.Active)
        .onGet(this.getActive.bind(this));

      this.fan
        .getCharacteristic(Characteristic.CurrentFanState)
        .onGet(this.getCurrentFanState.bind(this));

      this.fan
        .getCharacteristic(Characteristic.TargetFanState)
        .onGet(this.getTargetFanState.bind(this))
        .onSet(this.setTargetFanState.bind(this));

      this.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .setProps({ validValues: [20, 40, 50, 60, 80, 100] })
        .onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this));

      this.fan
        .getCharacteristic(Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    }

    this.device.addListener("patch", this.updateCharacteristics.bind(this));
    this.pruneUnusedServices();
  }

  getService(serviceType: ServiceType, name = this.device.name) {
    if (isServiceInstance(serviceType)) {
      return serviceType;
    }

    const existingService = this.accessory.getService(serviceType);
    const service =
      existingService || this.accessory.addService(serviceType, name);

    if (
      existingService &&
      existingService.displayName &&
      name !== existingService.displayName
    ) {
      throw new Error(
        `Overlapping services for device ${this.device.name} - ${name} != ${existingService.displayName} - ${serviceType}`
      );
    }

    this.servicesInUse.add(service);
    return service;
  }

  pruneUnusedServices() {
    const safeServiceUUIDs = [
      hap.Service.AccessoryInformation.UUID,
      hap.Service.Thermostat.UUID,
      hap.Service.TemperatureSensor.UUID,
      hap.Service.Fanv2.UUID,
    ];

    this.accessory.services.forEach((service) => {
      if (
        !this.servicesInUse.has(service) ||
        !safeServiceUUIDs.includes(service.UUID)
      ) {
        this.log.info(
          "Pruning unused service",
          service.UUID,
          service.displayName || service.name,
          "from",
          this.device.name
        );

        this.accessory.removeService(service);
      }
    });
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
      case "ext_temp":
        if (this.exteriorSensor) {
          this.exteriorSensor.updateCharacteristic(
            Characteristic.CurrentTemperature,
            this.device.exteriorTemperature
          );
        }
        break;
      case "work_temp":
        this.thermostat.updateCharacteristic(
          Characteristic.CurrentTemperature,
          this.device.currentTemperature
        );
        break;
      case "setpoint_air_auto":
      case "setpoint_air_cool":
      case "setpoint_air_heat":
        this.thermostat.updateCharacteristic(
          Characteristic.TargetTemperature,
          this.device.targetTemperature
        );
        break;
      case "real_mode":
      case "mode":
      case "power":
        if (this.device.power === false) {
          this.thermostat.updateCharacteristic(
            Characteristic.CurrentHeatingCoolingState,
            Characteristic.CurrentHeatingCoolingState.OFF
          );
          this.thermostat.updateCharacteristic(
            Characteristic.TargetHeatingCoolingState,
            Characteristic.TargetHeatingCoolingState.OFF
          );
        } else {
          this.thermostat.updateCharacteristic(
            Characteristic.CurrentHeatingCoolingState,
            this.device.realMode === DeviceMode.COOL
              ? Characteristic.CurrentHeatingCoolingState.COOL
              : Characteristic.CurrentHeatingCoolingState.HEAT
          );
          this.thermostat.updateCharacteristic(
            Characteristic.TargetHeatingCoolingState,
            toTargetHeatingCoolingState(this.device.mode)
          );
          this.thermostat.updateCharacteristic(
            Characteristic.TargetTemperature,
            this.device.currentTemperature
          );
        }
        break;
      case "speed_state":
        if (this.fan) {
          this.fan.updateCharacteristic(
            Characteristic.RotationSpeed,
            this.device.fanSpeed
          );
        }
        break;
      case "slats_vertical_1":
        if (this.fan) {
          this.fan.updateCharacteristic(
            Characteristic.SwingMode,
            this.device.louverEnabled
              ? Characteristic.SwingMode.SWING_ENABLED
              : Characteristic.SwingMode.SWING_DISABLED
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
      Characteristic: {
        TargetTemperature,
        TargetHeatingCoolingState,
        CurrentHeatingCoolingState,
      },
    } = hap;

    if (value === TargetHeatingCoolingState.OFF) {
      this.device.power = false;
      this.thermostat.updateCharacteristic(
        CurrentHeatingCoolingState,
        CurrentHeatingCoolingState.OFF
      );
      return;
    }

    this.device.power = true;
    this.device.mode = toDeviceMode(value);
    this.thermostat.updateCharacteristic(
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

  getCurrentFanState(): CharacteristicValue {
    const { Characteristic } = hap;
    if (this.device.power) {
      return Characteristic.CurrentFanState.BLOWING_AIR;
    } else {
      return Characteristic.CurrentFanState.INACTIVE;
    }
  }

  getTargetFanState(): CharacteristicValue {
    const { Characteristic } = hap;
    if (this.device.fanSpeed === FAN_SPEED_AUTO) {
      return Characteristic.TargetFanState.AUTO;
    } else {
      return Characteristic.TargetFanState.MANUAL;
    }
  }

  setTargetFanState(value: CharacteristicValue) {
    const { Characteristic } = hap;
    if (value === Characteristic.TargetFanState.AUTO) {
      this.device.fanSpeed = FAN_SPEED_AUTO;
    } else {
      this.device.fanSpeed = 100;
    }
    if (this.fan) {
      this.fan.updateCharacteristic(
        Characteristic.RotationSpeed,
        this.device.fanSpeed
      );
    }
  }

  getRotationSpeed(): CharacteristicValue {
    return this.device.fanSpeed;
  }

  setRotationSpeed(value: CharacteristicValue) {
    const { Characteristic } = hap;
    this.device.fanSpeed = value as number;
    if (this.fan) {
      this.fan.updateCharacteristic(
        Characteristic.TargetFanState,
        this.device.fanSpeed === FAN_SPEED_AUTO
          ? Characteristic.TargetFanState.AUTO
          : Characteristic.TargetFanState.MANUAL
      );
    }
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

  getExteriorCurrentTemperature(): CharacteristicValue {
    return this.device.exteriorTemperature;
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
