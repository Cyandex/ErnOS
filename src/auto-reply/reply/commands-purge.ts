import fs from "node:fs/promises";
import path from "node:path";
import { listAgentSessionDirs, removePath } from "../../commands/cleanup-utils.js";
import { STATE_DIR } from "../../config/paths.js";
import { logVerbose } from "../../globals.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { CommandHandler } from "./commands-types.js";

/**
 * Runtime data directories to purge.
 * Config (ernos.json), identity/, completions/, devices/, and credentials are preserved.
 */
const RUNTIME_DIRS = ["memory", "delivery-queue", "logs", "canvas", "media"];

/** Lightweight runtime shim for removePath — logs to verbose and collects results. */
function createPurgeRuntime(removed: string[], errors: string[]): RuntimeEnv {
  return {
    log: (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      removed.push(msg);
      logVerbose(`[purge] ${msg}`);
    },
    error: (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      errors.push(msg);
      logVerbose(`[purge] ERROR: ${msg}`);
    },
    exit: () => {
      // no-op in chat context
    },
  };
}

export const handlePurgeCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  if (!/^\/purge(?:\s|$)/.test(normalized)) {
    return null;
  }

  // Admin only
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /purge from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const stateDir = STATE_DIR;
  const removed: string[] = [];
  const errors: string[] = [];
  const runtime = createPurgeRuntime(removed, errors);

  // Remove runtime directories
  for (const dir of RUNTIME_DIRS) {
    const dirPath = path.join(stateDir, dir);
    await removePath(dirPath, runtime, { label: dirPath });
  }

  // Remove agent session data
  const sessionDirs = await listAgentSessionDirs(stateDir);
  for (const dir of sessionDirs) {
    await removePath(dir, runtime, { label: dir });
  }

  // Remove RLHF feedback
  const rlhfPath = path.join(stateDir, "rlhf_feedback.jsonl");
  await removePath(rlhfPath, runtime, { label: rlhfPath });

  const removedCount = removed.length;
  const errorCount = errors.length;
  const summary =
    errorCount > 0
      ? `🌱 Runtime data purged (${removedCount} items removed, ${errorCount} errors). Config and prompts preserved.\n⚠️ Errors: ${errors.join(", ")}`
      : `🌱 Runtime data purged (${removedCount} items removed). Config and prompts preserved.\nRestart with \`./start-ernos.sh\` # to reinitialize.`;

  return {
    shouldContinue: false,
    reply: { text: summary },
  };
};
