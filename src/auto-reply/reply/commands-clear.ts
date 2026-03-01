import path from "node:path";
import { listAgentSessionDirs, removePath } from "../../commands/cleanup-utils.js";
import { STATE_DIR } from "../../config/paths.js";
import { logVerbose } from "../../globals.js";
import { KnowledgeGraph } from "../../memory/knowledge-graph/graph.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { CommandHandler } from "./commands-types.js";

/**
 * ALL runtime data directories to wipe for a totally clean slate.
 * Config (ernos.json), identity/, completions/, devices/, and credentials are preserved
 * so the system can reconnect to Discord, Ollama, etc. on reboot.
 */
const CLEAR_DIRS = [
  "memory",
  "delivery-queue",
  "logs",
  "canvas",
  "media",
  "cron",
  "sandbox",
  "workspace",
  "workspace-dev",
  "agents",
];

/** Lightweight runtime shim for removePath. */
function createClearRuntime(removed: string[], errors: string[]): RuntimeEnv {
  return {
    log: (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      removed.push(msg);
      logVerbose(`[clear] ${msg}`);
    },
    error: (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      errors.push(msg);
      logVerbose(`[clear] ERROR: ${msg}`);
    },
    exit: () => {
      // no-op in chat context
    },
  };
}

export const handleClearCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  if (!/^\/clear(?:\s|$)/.test(normalized)) {
    return null;
  }

  // Admin only
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /clear from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const stateDir = STATE_DIR;
  const removed: string[] = [];
  const errors: string[] = [];
  const runtime = createClearRuntime(removed, errors);

  // 1. Remove all runtime directories
  for (const dir of CLEAR_DIRS) {
    const dirPath = path.join(stateDir, dir);
    await removePath(dirPath, runtime, { label: dirPath });
  }

  // 2. Remove agent session data
  const sessionDirs = await listAgentSessionDirs(stateDir);
  for (const dir of sessionDirs) {
    await removePath(dir, runtime, { label: dir });
  }

  // 3. Remove RLHF feedback
  const rlhfPath = path.join(stateDir, "rlhf_feedback.jsonl");
  await removePath(rlhfPath, runtime, { label: rlhfPath });

  // 4. Clear Neo4j Knowledge Graph
  let graphNodesDeleted = 0;
  try {
    const graph = new KnowledgeGraph();
    graphNodesDeleted = await graph.clearAll();
    await graph.close();
  } catch (err) {
    errors.push(`Neo4j clear failed: ${err}`);
    logVerbose(`[clear] Neo4j clear failed: ${err}`);
  }

  const removedCount = removed.length;
  const errorCount = errors.length;
  const graphMsg =
    graphNodesDeleted > 0 ? ` Knowledge Graph: ${graphNodesDeleted} nodes deleted.` : "";
  const summary =
    errorCount > 0
      ? `🔥 Full system clear complete (${removedCount} items removed, ${errorCount} errors).${graphMsg}\n⚠️ Errors: ${errors.join(", ")}\n\nShutting down for fresh boot...`
      : `🔥 Full system clear complete (${removedCount} items removed).${graphMsg} Config and identity preserved.\n\nShutting down for fresh boot in 3s...`;

  // 5. Schedule shutdown — delay to let the reply send first
  setTimeout(() => {
    console.log("[clear] Shutting down process for fresh boot.");
    process.exit(0);
  }, 3000);

  return {
    shouldContinue: false,
    reply: { text: summary },
  };
};
