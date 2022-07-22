import type { API } from "homebridge";
import { DknCloudNaPlatform } from "./platform";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

import { setHap } from "./hap";

export default function (api: API) {
  setHap(api.hap);
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DknCloudNaPlatform);
}
