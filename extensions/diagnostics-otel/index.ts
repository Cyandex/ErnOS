import type { ErnOSPluginApi } from "ernos/plugin-sdk";
import { emptyPluginConfigSchema } from "ernos/plugin-sdk";
import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: ErnOSPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
