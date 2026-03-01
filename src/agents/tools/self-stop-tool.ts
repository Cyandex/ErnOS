/**
 * Self-Stop Tool — Lets Ernos abort its own processing when it realizes
 * it cannot fulfill a request, triggering a recovery flow.
 *
 * Ported from V3's self_stop_tool.py.
 *
 * Usage: When the agent recognises it's stuck in a loop, a required tool
 * doesn't exist, or it's approaching a problem incorrectly, it calls
 * self_stop with a reason.  The tool emits a bus event and returns a
 * structured cancellation signal that the agent loop interprets as a
 * hard stop.
 */

import { Type } from "@sinclair/typebox";
import { agentBus } from "../agent-bus.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

const SelfStopSchema = Type.Object({
  reason: Type.String({
    description:
      "Explain WHY you are stopping — e.g. the tool you need doesn't exist, " +
      "you're stuck in a loop, or your approach is wrong. " +
      "This reason feeds into the recovery response.",
  }),
});

/**
 * Creates the self_stop tool.
 *
 * When invoked the tool:
 * 1. Logs the reason
 * 2. Broadcasts a `selfStop` event on the agent bus so observers can react
 * 3. Returns a `[[SELF_STOP]]` marker token that the agent loop can
 *    interpret as a hard cancellation signal
 */
export function createSelfStopTool(opts?: { userId?: string }): AnyAgentTool {
  return {
    label: "Self-Stop",
    name: "self_stop",
    description:
      "Abort your current processing and generate a fresh response explaining why. " +
      "Use this when you realize you CANNOT fulfill the user's request — for example, " +
      "a tool you need doesn't exist, you're stuck in a loop, or you've been " +
      "approaching the problem incorrectly.",
    parameters: SelfStopSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const reason = readStringParam(params, "reason", { required: true });
      const userId = opts?.userId ?? "unknown";

      console.log(`[SelfStop] Ernos self-stopped for user ${userId}. Reason: ${reason}`);

      // Broadcast a bus event so observers/audit can log this
      agentBus.publish("self-stop-tool", "BROADCAST", "selfStop", {
        userId,
        reason,
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text",
            text:
              `[[SELF_STOP]] Self-stop triggered.\n` +
              `Reason: ${reason}\n\n` +
              `I have stopped my current approach because: ${reason}\n` +
              `I will now provide a corrected response.`,
          },
        ],
        details: { reason, userId },
      };
    },
  };
}
