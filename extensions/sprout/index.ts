import type {
  AnyAgentTool,
  ErnOSPluginApi,
  ErnOSPluginToolFactory,
} from "../../src/plugins/types.js";
import { createSproutTool } from "./src/sprout-tool.js";

export default function register(api: ErnOSPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createSproutTool(api) as AnyAgentTool;
    }) as ErnOSPluginToolFactory,
    { optional: true },
  );
}
