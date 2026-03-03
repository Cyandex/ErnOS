/**
 * ChatDev Integration — Singleton Instance Manager
 *
 * Ensures only a single ChatDevSidecar and Bridge is spawned
 * across all tools (e.g. `devteam` and `chatdev_orchestrator`).
 */

import { ChatDevSidecar } from "./sidecar.js";
import { ChatDevBridge } from "./bridge.js";
import { WorkflowRegistry } from "./workflow-registry.js";
import type { ErnOSConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";

let sidecarInstance: ChatDevSidecar | null = null;
let bridgeInstance: ChatDevBridge | null = null;
let registryInstance: WorkflowRegistry | null = null;

export async function ensureSharedSidecar(config?: ErnOSConfig) {
  if (sidecarInstance) {
    return { sidecar: sidecarInstance, bridge: bridgeInstance!, registry: registryInstance! };
  }

  const cfg = config ?? loadConfig();
  const chatdevPath =
    ((cfg as Record<string, unknown>).chatdevPath as string) ??
    `${process.env.HOME}/Desktop/ChatDev`;

  sidecarInstance = new ChatDevSidecar({
    chatdevPath,
    port: 8766,
    host: "127.0.0.1",
    pythonCommand: `${process.env.HOME}/.local/bin/uv run`,
    autoRestart: true,
  });

  await sidecarInstance.start();

  bridgeInstance = new ChatDevBridge(sidecarInstance);
  registryInstance = new WorkflowRegistry(chatdevPath);

  return { sidecar: sidecarInstance, bridge: bridgeInstance, registry: registryInstance };
}
