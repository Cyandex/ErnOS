import { Type } from "@sinclair/typebox";
import { goals } from "../../memory/goals.js";

export const createGoalsTools = () => {
  return [
    {
      name: "goal_create",
      label: "Create Goal",
      description: "Creates a new tracked goal for long-term task execution.",
      parameters: Type.Object({
        title: Type.String(),
        description: Type.String(),
        parentGoalId: Type.Optional(
          Type.String({ description: "Optional ID of the parent goal to nest this under." }),
        ),
      }),
      execute: async (_toolCallId: string, args: any) => {
        const goal = goals.createGoal(args.title, args.description, args.parentGoalId);
        return `Created Goal: ${goal.id}`;
      },
    },
    {
      name: "goal_list_active",
      label: "List Active Goals",
      description: "Lists all currently active goals.",
      parameters: Type.Object({}),
      execute: async (_toolCallId: string) => {
        const active = goals.getActiveGoals();
        return active.length > 0 ? JSON.stringify(active, null, 2) : "No active goals.";
      },
    },
    {
      name: "goal_update_progress",
      label: "Update Goal Progress",
      description: "Updates the progress (0-100) or status of an existing goal.",
      parameters: Type.Object({
        goalId: Type.String(),
        progress: Type.Number({ minimum: 0, maximum: 100 }),
        status: Type.Optional(
          Type.Unsafe<string>({ type: "string", enum: ["active", "completed", "abandoned"] }),
        ),
      }),
      execute: async (_toolCallId: string, args: any) => {
        const res = goals.updateProgress(args.goalId, args.progress, args.status);
        return res
          ? `Updated Goal ${args.goalId} to ${args.progress}%`
          : `Goal ${args.goalId} not found.`;
      },
    },
  ];
};
