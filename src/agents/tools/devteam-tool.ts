/**
 * DevTeam Tool — ChatDev multi-agent workflow execution
 *
 * Allows ErnOS to spawn multi-agent teams via ChatDev 2.0 workflows.
 * Actions: list, run, status, stop.
 */

import { Type } from "@sinclair/typebox";
import type { ErnOSConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam, ToolInputError, jsonResult } from "./common.js";

const log = createSubsystemLogger("devteam-tool");

const DevTeamSchema = Type.Object({
  action: Type.Union(
    [Type.Literal("list"), Type.Literal("run"), Type.Literal("status"), Type.Literal("stop")],
    { description: "Action: list workflows, run a workflow, check status, or stop." },
  ),
  workflow: Type.Optional(
    Type.String({
      description:
        "YAML workflow filename (e.g. 'ChatDev_v1.yaml', 'deep_research_v1.yaml'). Required for 'run'.",
    }),
  ),
  prompt: Type.Optional(
    Type.String({ description: "Task prompt for the workflow. Required for 'run'." }),
  ),
  session_name: Type.Optional(Type.String({ description: "Session name for 'status' or 'stop'." })),
});

import { ensureSharedSidecar } from "../../chatdev/instance.js";

export function createDevTeamTool(opts?: {
  config?: ErnOSConfig;
  agentAccountId?: string;
}): AnyAgentTool {
  return {
    label: "DevTeam",
    name: "devteam",
    description: [
      "Multi-agent workflow orchestration via ChatDev 2.0.",
      "Actions:",
      "  list — List available workflows (software dev, deep research, 3D, data viz).",
      "  run — Run a workflow: requires 'workflow' (filename) and 'prompt' (task description).",
      "  status — Show active workflow status.",
      "  stop — Cancel a running workflow by session_name.",
      "",
      "Common workflows: ChatDev_v1.yaml (full software dev), deep_research_v1.yaml (deep research),",
      "data_visualization_basic.yaml (charts), GameDev_v1.yaml (game dev).",
    ].join("\n"),
    parameters: DevTeamSchema,
    ownerOnly: true,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      try {
        switch (action) {
          case "list":
            return await handleList(opts?.config);
          case "run":
            return await handleRun(params, opts?.config, opts?.agentAccountId);
          case "status":
            return await handleStatus();
          case "stop":
            return await handleStop(params);
          default:
            throw new ToolInputError(`Unknown action: ${action}. Use: list, run, status, stop.`);
        }
      } catch (err) {
        if (err instanceof ToolInputError) {throw err;}
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`DevTeam tool error: ${msg}`);
        return jsonResult({
          success: false,
          error: msg,
        });
      }
    },
  };
}

// ─── Action Handlers ───────────────────────────────────────────────────

async function handleList(config?: ErnOSConfig) {
  const { registry } = await ensureSharedSidecar(config);
  const workflows = registry.scan();

  return jsonResult({
    success: true,
    total: workflows.length,
    workflows: workflows.map((w) => ({
      filename: w.filename,
      name: w.displayName,
      description: w.description,
      category: w.category,
    })),
    formatted: registry.formatList(),
  });
}

async function handleRun(params: Record<string, unknown>, config?: ErnOSConfig, userId?: string) {
  const workflow = readStringParam(params, "workflow", { required: true });
  const prompt = readStringParam(params, "prompt", { required: true });
  const sessionName = `devteam_${Date.now()}`;

  const { bridge } = await ensureSharedSidecar(config);

  log.info(
    `DevTeam: running workflow=${workflow} prompt="${prompt.slice(0, 80)}..." session=${sessionName}`,
  );

  // Fire-and-forget — run the workflow in the background so the agent
  // returns immediately to the user. They can check progress with `devteam status`.
  void bridge
    .executeWorkflow({
      yamlFile: workflow,
      taskPrompt: prompt,
      userId,
      sessionName,
    })
    .then((result) => {
      log.info(
        `DevTeam: workflow ${sessionName} finished: status=${result.status} output=${result.outputDir}`,
      );
    })
    .catch((err) => {
      log.warn(
        `DevTeam: workflow ${sessionName} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

  return jsonResult({
    success: true,
    status: "started",
    sessionName,
    message: `Workflow "${workflow}" started in background as session "${sessionName}". Use \`devteam status\` to check progress.`,
  });
}

async function handleStatus(config?: ErnOSConfig) {
  const { sidecar, bridge } = await ensureSharedSidecar(config);

  const active = bridge.getActiveWorkflows();
  if (active.length === 0) {
    return jsonResult({
      success: true,
      sidecar: sidecar.getStatus(),
      activeWorkflows: [],
    });
  }

  return jsonResult({
    success: true,
    sidecar: sidecar.getStatus(),
    activeWorkflows: active.map((w) => ({
      sessionName: w.sessionName,
      userId: w.userId,
      durationMs: w.durationMs,
      duration: `${Math.round(w.durationMs / 1000)}s`,
    })),
  });
}

async function handleStop(params: Record<string, unknown>, config?: ErnOSConfig) {
  const sessionName = readStringParam(params, "session_name", { required: true });

  const { bridge } = await ensureSharedSidecar(config);

  const activeWorkflows = bridge.getActiveWorkflows();
  if (!activeWorkflows.find((w) => w.sessionName === sessionName)) {
    throw new ToolInputError(`Workflow session '${sessionName}' not found or already finished.`);
  }

  bridge.cancelWorkflow(sessionName);

  return jsonResult({
    success: true,
    cancelled: sessionName,
  });
}
