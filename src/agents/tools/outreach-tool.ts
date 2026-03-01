/**
 * Outreach tool — agent-facing interface for the OutreachManager.
 *
 * Allows the agent to check outreach timing, get/set user settings,
 * and record successful outreach delivery.
 */
import { Type } from "@sinclair/typebox";
import { OutreachManager } from "../../memory/outreach.js";
import type { OutreachPolicy, OutreachFrequency } from "../../memory/outreach.js";

const manager = new OutreachManager();

export function createOutreachTool() {
  return {
    name: "outreach",
    label: "Outreach Manager",
    description:
      "Manage proactive outreach to users. Actions: 'check' (can I reach out now?), " +
      "'get_settings' (view user outreach preferences), " +
      "'set_policy' (public/private/both/none), " +
      "'set_frequency' (low=24h/medium=12h/high=3h/unlimited), " +
      "'record' (log that outreach was sent to this user).",
    parameters: Type.Object({
      action: Type.String({
        description: "Action: check, get_settings, set_policy, set_frequency, record",
      }),
      userId: Type.String({
        description: "Discord user ID to check/configure outreach for",
      }),
      policy: Type.Optional(
        Type.String({
          description: "Outreach policy (for set_policy): public, private, both, none",
        }),
      ),
      frequency: Type.Optional(
        Type.String({
          description: "Outreach frequency (for set_frequency): low, medium, high, unlimited",
        }),
      ),
    }),
    execute: async (_toolCallId: string, params: any) => {
      const action = params.action as string;
      const userId = params.userId as string;

      if (!userId) {
        return JSON.stringify({ error: "userId is required" });
      }

      switch (action) {
        case "check": {
          const result = manager.canOutreach(userId);
          return JSON.stringify({
            allowed: result.allowed,
            reason: result.reason,
            settings: manager.getSettings(userId),
          });
        }
        case "get_settings": {
          return JSON.stringify(manager.getSettings(userId));
        }
        case "set_policy": {
          const policy = params.policy as OutreachPolicy | undefined;
          if (!policy) {
            return JSON.stringify({
              error: "policy is required for set_policy action",
            });
          }
          const result = manager.setPolicy(userId, policy);
          return JSON.stringify({
            result,
            settings: manager.getSettings(userId),
          });
        }
        case "set_frequency": {
          const frequency = params.frequency as OutreachFrequency | undefined;
          if (!frequency) {
            return JSON.stringify({
              error: "frequency is required for set_frequency action",
            });
          }
          const result = manager.setFrequency(userId, frequency);
          return JSON.stringify({
            result,
            settings: manager.getSettings(userId),
          });
        }
        case "record": {
          manager.recordOutreach(userId);
          return JSON.stringify({
            result: `✅ Outreach recorded for user ${userId}.`,
            settings: manager.getSettings(userId),
          });
        }
        default:
          return JSON.stringify({
            error: `Unknown action: ${action}. Use: check, get_settings, set_policy, set_frequency, record`,
          });
      }
    },
  };
}
