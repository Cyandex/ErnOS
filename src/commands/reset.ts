import path from "node:path";
import { cancel, confirm, isCancel } from "@clack/prompts";
import { formatCliCommand } from "../cli/command-format.js";
import { isNixMode } from "../config/config.js";
import { resolveGatewayService } from "../daemon/service.js";
import type { RuntimeEnv } from "../runtime.js";
import { selectStyled } from "../terminal/prompt-select-styled.js";
import { stylePromptMessage, stylePromptTitle } from "../terminal/prompt-style.js";
import { resolveCleanupPlanFromDisk } from "./cleanup-plan.js";
import {
  listAgentSessionDirs,
  removePath,
  removeStateAndLinkedPaths,
  removeWorkspaceDirs,
} from "./cleanup-utils.js";

export type ResetScope = "config" | "config+creds+sessions" | "runtime" | "full";

export type ResetOptions = {
  scope?: ResetScope;
  yes?: boolean;
  nonInteractive?: boolean;
  dryRun?: boolean;
};

async function stopGatewayIfRunning(runtime: RuntimeEnv) {
  if (isNixMode) {
    return;
  }
  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    runtime.error(`Gateway service check failed: ${String(err)}`);
    return;
  }
  if (!loaded) {
    return;
  }
  try {
    await service.stop({ env: process.env, stdout: process.stdout });
  } catch (err) {
    runtime.error(`Gateway stop failed: ${String(err)}`);
  }
}

export async function resetCommand(runtime: RuntimeEnv, opts: ResetOptions) {
  const interactive = !opts.nonInteractive;
  if (!interactive && !opts.yes) {
    runtime.error("Non-interactive mode requires --yes.");
    runtime.exit(1);
    return;
  }

  let scope = opts.scope;
  if (!scope) {
    if (!interactive) {
      runtime.error("Non-interactive mode requires --scope.");
      runtime.exit(1);
      return;
    }
    const selection = await selectStyled<ResetScope>({
      message: "Reset scope",
      options: [
        {
          value: "runtime",
          label: "Runtime data only",
          hint: "sessions + memory + logs — keeps config & prompts",
        },
        {
          value: "config",
          label: "Config only",
          hint: "ernos.json",
        },
        {
          value: "config+creds+sessions",
          label: "Config + credentials + sessions",
          hint: "keeps workspace + auth profiles",
        },
        {
          value: "full",
          label: "Full reset",
          hint: "state dir + workspace",
        },
      ],
      initialValue: "runtime",
    });
    if (isCancel(selection)) {
      cancel(stylePromptTitle("Reset cancelled.") ?? "Reset cancelled.");
      runtime.exit(0);
      return;
    }
    scope = selection;
  }

  if (!["config", "config+creds+sessions", "runtime", "full"].includes(scope)) {
    runtime.error(
      'Invalid --scope. Expected "config", "config+creds+sessions", "runtime", or "full".',
    );
    runtime.exit(1);
    return;
  }

  if (interactive && !opts.yes) {
    const ok = await confirm({
      message: stylePromptMessage(`Proceed with ${scope} reset?`),
    });
    if (isCancel(ok) || !ok) {
      cancel(stylePromptTitle("Reset cancelled.") ?? "Reset cancelled.");
      runtime.exit(0);
      return;
    }
  }

  const dryRun = Boolean(opts.dryRun);
  const { stateDir, configPath, oauthDir, configInsideState, oauthInsideState, workspaceDirs } =
    resolveCleanupPlanFromDisk();

  if (scope !== "config") {
    if (dryRun) {
      runtime.log("[dry-run] stop gateway service");
    } else {
      await stopGatewayIfRunning(runtime);
    }
  }

  if (scope === "runtime") {
    // Clear runtime data only: memory, sessions, delivery-queue, logs, canvas, media
    // Preserves: ernos.json, .env, identity/, completions/, devices/, credentials
    const runtimeDirs = ["memory", "delivery-queue", "logs", "canvas", "media"];
    for (const dir of runtimeDirs) {
      const dirPath = path.join(stateDir, dir);
      await removePath(dirPath, runtime, { dryRun, label: dirPath });
    }
    // Clear agent session data
    const sessionDirs = await listAgentSessionDirs(stateDir);
    for (const dir of sessionDirs) {
      await removePath(dir, runtime, { dryRun, label: dir });
    }
    // Clear RLHF feedback
    const rlhfPath = path.join(stateDir, "rlhf_feedback.jsonl");
    await removePath(rlhfPath, runtime, { dryRun, label: rlhfPath });
    runtime.log("\n🌱 Runtime data cleared. Config and prompts preserved.");
    runtime.log(`Next: ${formatCliCommand("./start-ernos.sh")}`);
    return;
  }

  if (scope === "config") {
    await removePath(configPath, runtime, { dryRun, label: configPath });
    return;
  }

  if (scope === "config+creds+sessions") {
    await removePath(configPath, runtime, { dryRun, label: configPath });
    await removePath(oauthDir, runtime, { dryRun, label: oauthDir });
    const sessionDirs = await listAgentSessionDirs(stateDir);
    for (const dir of sessionDirs) {
      await removePath(dir, runtime, { dryRun, label: dir });
    }
    runtime.log(`Next: ${formatCliCommand("ernos onboard --install-daemon")}`);
    return;
  }

  if (scope === "full") {
    await removeStateAndLinkedPaths(
      { stateDir, configPath, oauthDir, configInsideState, oauthInsideState },
      runtime,
      { dryRun },
    );
    await removeWorkspaceDirs(workspaceDirs, runtime, { dryRun });
    runtime.log(`Next: ${formatCliCommand("ernos onboard --install-daemon")}`);
    return;
  }
}
