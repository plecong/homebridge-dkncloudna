import type { API } from "homebridge";
import { DknCloudNaPlatform, PLATFORM_NAME, PLUGIN_NAME } from "./platform";
import { setHap } from "./hap";

export default function (api: API) {
  setHap(api.hap);
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DknCloudNaPlatform);
}
