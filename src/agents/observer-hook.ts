import { observer } from "./observer/observer.js";
import { runEmbeddedPiAgent } from "./pi-embedded-runner/run.js";
import type { RunEmbeddedPiAgentParams } from "./pi-embedded-runner/run/params.js";
import type { EmbeddedPiRunResult } from "./pi-embedded-runner/types.js";

// ─── Cross-Turn Tool History ──────────────────────────────────────────
// Module-level ring buffer of the last 50 tool results across all turns.
// Allows the Observer to verify claims about prior-turn tool usage.
// Resets on process restart — intentional, since old session history isn't meaningful.
const TOOL_HISTORY_MAX = 50;
const crossTurnToolHistory: Array<{ name: string; output: string; ts: number }> = [];

/**
 * Wrapper for runEmbeddedPiAgent that intercepts the final response and runs the Observer audit.
 * If the Skeptic blocks the response, it recursively retries up to maxRetries times,
 * prepending the Observer's guidance to the system prompt.
 *
 * Ported from ErnOS 3.0 integrity_auditor + cognition/safety.py audit loop.
 *
 * V4 enhancements over V3:
 * - Cross-turn tool history (ring buffer, last 50 tool results)
 * - Unified context sharing (8000 char window for system + conversation)
 *
 * NOTE: Mid-generation cognitive loop (regex pattern detection) was disabled.
 * The Observer post-hoc LLM audit is the sole integrity check. The cognitive-loop
 * module remains available for re-enablement if needed.
 */
export async function runWithObserverAudit(
  params: RunEmbeddedPiAgentParams,
  maxRetries = 2,
): Promise<EmbeddedPiRunResult> {
  let attempt = 0;
  let currentParams = { ...params };
  let lastGuidance = "";

  while (attempt <= maxRetries) {
    if (lastGuidance) {
      // Inject guidance into the next run's extra system prompt (same as v3 cognition retry pattern)
      const guidancePrefix = `[OBSERVER GUIDANCE - CORRECTION REQUIRED]: ${lastGuidance}\n\n`;
      currentParams = {
        ...currentParams,
        extraSystemPrompt: guidancePrefix + (currentParams.extraSystemPrompt ?? ""),
      };
    }

    // Detect image count from params.images (pi-embedded-runner image injection)
    let imageCount = 0;
    if (currentParams.images && Array.isArray(currentParams.images)) {
      imageCount += currentParams.images.length;
    }

    // Accumulate tool outputs during this run for the audit
    const collectedToolOutputs: Array<{ name: string; output: string }> = [];
    const originalOnToolResult = currentParams.onToolResult;
    const wrappedParams = {
      ...currentParams,
      onToolResult: (payload: { text?: string; mediaUrls?: string[] }) => {
        if (payload.text) {
          collectedToolOutputs.push({ name: "tool_result", output: payload.text });
        }
        originalOnToolResult?.(payload);
      },
    };

    // Run the V4 embedded agent
    const result = await runEmbeddedPiAgent(wrappedParams);

    // Extract the final text from the result payloads
    const botMsg =
      result?.payloads
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "";

    // Use the actual tool outputs collected during the run
    const toolOutputs =
      collectedToolOutputs.length > 0
        ? collectedToolOutputs
        : (result?.meta?.pendingToolCalls?.map((t) => ({
            name: t.name,
            output: t.arguments,
          })) ?? []);

    // Extract user message from the prompt
    const userMsg = currentParams.prompt || "";

    // Build real context for the audit — all systems share unified context.
    // V3's SuperEgo/Skeptic/Auditor received full context. We replicate that here.

    // 1. System context — extraSystemPrompt carries the unified ErnOS identity + kernel prompt.
    //    8000 chars preserves the full identity/kernel context that grounds the audit.
    const systemContext = currentParams.extraSystemPrompt
      ? currentParams.extraSystemPrompt.slice(0, 8000)
      : "ErnOS v4 agent runtime — no additional system context available.";

    // 2. Conversation context — the user's prompt with all memory-tier injections.
    //    8000 chars ensures the Observer sees enough grounding data to catch hallucinations.
    const conversationContext = currentParams.prompt
      ? currentParams.prompt.slice(0, 8000)
      : "NO CONVERSATION CONTEXT AVAILABLE.";

    // 3. History lines — cross-turn tool history + current-turn tools
    const historyLines: string[] = [];

    // 3a. Prior-turn tool history (from ring buffer — last 20 entries max)
    const priorHistory = crossTurnToolHistory
      .slice(-20)
      .map((t) => `[PRIOR TURN TOOL] ${t.name}: ${t.output.slice(0, 300)}`);
    historyLines.push(...priorHistory);

    // 3b. Current-turn tool outputs
    for (const t of collectedToolOutputs) {
      historyLines.push(`[TOOL] ${t.name}: ${t.output.slice(0, 500)}`);
    }

    // Run the Skeptic Audit with real context
    const auditModel = currentParams.model || "qwen3.5:35b";
    const auditResult = await observer.auditResponse(
      userMsg,
      botMsg,
      toolOutputs,
      historyLines,
      systemContext,
      conversationContext,
      imageCount,
      auditModel,
    );

    // Archive current-turn tools into cross-turn ring buffer (regardless of audit result)
    for (const t of collectedToolOutputs) {
      crossTurnToolHistory.push({ name: t.name, output: t.output, ts: Date.now() });
      if (crossTurnToolHistory.length > TOOL_HISTORY_MAX) crossTurnToolHistory.shift();
    }

    if (auditResult.allowed) {
      return result; // Passed!
    } else {
      console.warn(`[Observer Hook] Attempt ${attempt + 1} BLOCKED: ${auditResult.reason}`);
      lastGuidance =
        auditResult.guidance ||
        "Please correct the previous response. Do not hallucinate or fabricate information.";
      attempt++;
    }
  }

  // After max retries, don't crash — fail open with a warning (v3 pattern: fail-open to prevent paralysis)
  console.error("[Observer Hook] Max retries exceeded — allowing last response with warning.");
  // Re-run one final time without audit to get the result
  return await runEmbeddedPiAgent(currentParams);
}

// Export for testing
export const _test = {
  crossTurnToolHistory,
  TOOL_HISTORY_MAX,
};
