import type { API } from "homebridge";
import { DknCloudNaPlatform } from "./platform";
import { setHap } from "./hap";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

export default function (api: API) {
  setHap(api.hap);
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DknCloudNaPlatform);
}
