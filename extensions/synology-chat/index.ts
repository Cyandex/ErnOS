import type { ErnOSPluginApi } from "ernos/plugin-sdk";
import { emptyPluginConfigSchema } from "ernos/plugin-sdk";
import { createSynologyChatPlugin } from "./src/channel.js";
import { setSynologyRuntime } from "./src/runtime.js";

const plugin = {
  id: "synology-chat",
  name: "Synology Chat",
  description: "Native Synology Chat channel plugin for ErnOS",
  configSchema: emptyPluginConfigSchema(),
  register(api: ErnOSPluginApi) {
    setSynologyRuntime(api.runtime);
    api.registerChannel({ plugin: createSynologyChatPlugin() });
  },
};

export default plugin;
