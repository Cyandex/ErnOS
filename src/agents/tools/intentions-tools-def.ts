import { Type } from "@sinclair/typebox";
import { intentionTracker } from "../../memory/intentions.js";

export const createIntentionTools = () => {
  return [
    {
      name: "recall_intentions",
      label: "Recall Intentions",
      description: "Recalls your recent autonomous thoughts and intentions to explain motivations for past actions.",
      parameters: Type.Object({
        limit: Type.Optional(Type.Number({ description: "Number of recent intentions to recall. Default 10." })),
      }),
      execute: async (args: any) => {
        const intentions = intentionTracker.getRecentIntentions(args.limit || 10);
        if (intentions.length === 0) return "No intentions recorded recently.";
        return intentions
          .map((i) => `[${new Date(i.timestamp).toISOString()}] Intent: ${i.thought}`)
          .join("\n");
      },
    }
  ];
};
