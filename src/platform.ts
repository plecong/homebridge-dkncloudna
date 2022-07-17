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

export class DknCloudNaPlatform implements DynamicPlatformPlugin {
  private readonly config: PlatformConfig & DCNAConfig;
  private readonly accessories: Record<string, PlatformAccessory> = {};
  private readonly cloudApi!: Api;

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
    this.cloudApi = new Api(this.config, log);

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("didFinishLaunching");
      this.connectToCloud().catch((e) => {
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

  async connectToCloud(): Promise<void> {
    const { api } = this;
    const cachedAccessoryIds = Object.keys(this.accessories);
    const activeAccessoryIds: string[] = [];
    const createdAccessories: PlatformAccessory[] = [];

    await this.cloudApi.connect();

    for (const device of this.cloudApi.getDevices()) {
      let accessory: PlatformAccessory;

      const uuid = hap.uuid.generate(device.mac);
      const existingAccessory = this.accessories[uuid];

      // create a new one
      if (existingAccessory) {
        accessory = existingAccessory;
      } else {
        accessory = new api.platformAccessory(
          device.name,
          uuid,
          hap.Categories.AIR_CONDITIONER
        );
        createdAccessories.push(accessory);
      }

      new DeviceAccessory(device, accessory, this.log, this.config);
      this.accessories[uuid] = accessory;
      activeAccessoryIds.push(uuid);
    }

    // register created accesories
    if (createdAccessories.length) {
      api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        createdAccessories
      );
    }

    // unregister stale accessories
    const staleAccessories = cachedAccessoryIds
      .filter((cachedId) => !activeAccessoryIds.includes(cachedId))
      .map((id) => this.accessories[id]!);

    staleAccessories.forEach((staleAccessory) => {
      this.log.info(
        `Removing stale cached accessory ${staleAccessory.UUID} ${staleAccessory.displayName}`
      );
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
