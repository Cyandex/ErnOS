import { agentBus } from "./agent-bus.js";
import { parallelExecutor } from "./parallel-tool-executor.js";
/**
 * Swarm Coordinator — Orchestrates competitive and fan_out subagent spawning.
 *
 * Bridges the gap between the declared spawn modes in subagent-spawn.ts
 * and the swarm modules (ResultAggregator, AgentBus, ParallelToolExecutor).
 *
 * Used by the tool system when the agent requests multi-agent execution.
 */
import { aggregator, type AggregationStrategy } from "./result-aggregator.js";
import {
  spawnSubagentDirect,
  type SpawnSubagentParams,
  type SpawnSubagentContext,
  type SpawnSubagentResult,
} from "./subagent-spawn.js";

export interface SwarmRequest {
  tasks: Array<{ task: string; label?: string; agentId?: string }>;
  mode: "competitive" | "fan_out";
  aggregation?: AggregationStrategy;
}

export interface SwarmResult {
  status: "completed" | "partial" | "error";
  results: Array<{ label: string; result: SpawnSubagentResult }>;
  aggregated?: string;
}

/**
 * Dispatches multiple subagent tasks in parallel (fan_out) or competitively.
 *
 * - fan_out: All tasks run simultaneously, results aggregated via chosen strategy
 * - competitive: Same task dispatched to N agents, best result selected
 */
export async function executeSwarm(
  request: SwarmRequest,
  ctx: SpawnSubagentContext,
): Promise<SwarmResult> {
  const { tasks, mode, aggregation = "concat" } = request;

  console.log(`[SwarmCoordinator] Dispatching ${tasks.length} tasks in ${mode} mode.`);

  // Publish swarm start event on the bus
  agentBus.publish("SwarmCoordinator", "BROADCAST", "swarm:start", {
    mode,
    taskCount: tasks.length,
    timestamp: Date.now(),
  });

  // Spawn all subagents in parallel
  const spawnPromises = tasks.map(async (t) => {
    const params: SpawnSubagentParams = {
      task: t.task,
      label: t.label || `swarm-${mode}-${Date.now()}`,
      agentId: t.agentId,
      mode: mode === "competitive" ? "run" : "run",
    };

    const result = await spawnSubagentDirect(params, ctx);
    return { label: t.label || t.task.slice(0, 50), result };
  });

  const results = await Promise.allSettled(spawnPromises);
  const settled = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      label: tasks[i].label || "failed",
      result: { status: "error" as const, error: String(r.reason) },
    };
  });

  // Collect text responses for aggregation (from accepted spawns)
  const textResults = settled
    .filter((s) => s.result.status === "accepted")
    .map((s) => s.result.note || `Task accepted: ${s.label}`);

  // Aggregate results
  let aggregated: string | undefined;
  if (textResults.length > 0) {
    aggregated = await aggregator.aggregate(textResults, aggregation);
  }

  // Publish swarm completion event
  agentBus.publish("SwarmCoordinator", "BROADCAST", "swarm:complete", {
    mode,
    totalTasks: tasks.length,
    accepted: settled.filter((s) => s.result.status === "accepted").length,
    errors: settled.filter((s) => s.result.status === "error").length,
    timestamp: Date.now(),
  });

  const allAccepted = settled.every((s) => s.result.status === "accepted");
  const anyAccepted = settled.some((s) => s.result.status === "accepted");

  return {
    status: allAccepted ? "completed" : anyAccepted ? "partial" : "error",
    results: settled,
    aggregated,
  };
}

/**
 * Re-export the ParallelToolExecutor for use in tool execution pipelines.
 */
export { parallelExecutor };
