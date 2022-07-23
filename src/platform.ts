import { APIEvent } from "homebridge";
import type {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import { DeviceAccessory } from "./accessory";
import { Api } from "./api";
import type { DCNAConfig } from "./config";
import { hap } from "./hap";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import type { DeviceTwin } from "./device";

export class DknCloudNaPlatform implements DynamicPlatformPlugin {
  private readonly config: PlatformConfig & DCNAConfig;
  private readonly accessories: Record<string, PlatformAccessory> = {};
  private readonly devices: Record<string, DeviceAccessory> = {};
  private readonly cloud: Api;

  constructor(
    private readonly log: Logging,
    config: PlatformConfig,
    private readonly api: API
  ) {
    if (!config) {
      log.error("No configuration found for platform DknCloudNA");
      throw Error("No configuration found for platform DknCloudNA");
    }

    this.config = config as PlatformConfig & DCNAConfig;
    this.cloud = new Api(this.config, api, log);
    this.cloud.on("devices", this.registerDevices.bind(this));

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("didFinishLaunching");
      this.cloud.connect().catch((e) => {
        this.log.error("Error connecting to API");
        this.log.error(e);
      });
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info(
      `Configuring cached accessory ${accessory.UUID} ${accessory.displayName}`
    );
    this.log.debug("%j", accessory);
    this.accessories[accessory.UUID] = accessory;
  }

  registerDevices(devices: DeviceTwin[]): void {
    const cachedAccessoryIds = Object.keys(this.accessories);
    const activeAccessoryIds: string[] = [];
    const createdAccessories: PlatformAccessory[] = [];

    for (const device of devices) {
      const uuid = hap.uuid.generate(device.key);
      const existingAccessory = this.accessories[uuid];

      let accessory: PlatformAccessory;
      if (existingAccessory) {
        accessory = existingAccessory;
      } else {
        this.log.info(`Creating new accessory ${uuid} ${device.name}`);
        accessory = new this.api.platformAccessory(
          device.name,
          uuid,
          hap.Categories.AIR_CONDITIONER
        );
        this.accessories[uuid] = accessory;
        createdAccessories.push(accessory);
      }

      const existingDevice = this.devices[uuid];
      if (existingDevice) {
        existingDevice.updateDevice(device);
      } else {
        this.devices[uuid] = new DeviceAccessory(device, accessory, this.log);
      }
      activeAccessoryIds.push(uuid);
    }

    // register created accesories
    if (createdAccessories.length) {
      this.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        createdAccessories
      );
    }

    // unregister stale accessories
    const staleAccessories = cachedAccessoryIds
      .filter((cachedId) => !activeAccessoryIds.includes(cachedId))
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((id) => this.accessories[id]!);

    staleAccessories.forEach((staleAccessory) => {
      const uuid = staleAccessory.UUID;
      this.log.info(
        `Removing stale cached accessory ${uuid} ${staleAccessory.displayName}`
      );
      if (this.devices[uuid]) {
        delete this.devices[uuid];
      }
      if (this.accessories[uuid]) {
        delete this.accessories[uuid];
      }
    });

    if (staleAccessories.length) {
      this.api.unregisterPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        staleAccessories
      );
    }
  }
}
