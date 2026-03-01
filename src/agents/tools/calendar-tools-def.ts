import { Type } from "@sinclair/typebox";
import { calendar } from "../../memory/calendar.js";

export const createCalendarTools = (userId: string) => {
  return [
    {
      name: "calendar_create",
      label: "Create Calendar Event",
      description:
        'Creates a new calendar event. Supports one-time and recurring events (daily, weekly, monthly, yearly). For birthdays/anniversaries use frequency "yearly".',
      parameters: Type.Object({
        title: Type.String({ description: "Short title of the event." }),
        description: Type.String({ description: "Detailed description." }),
        startTime: Type.String({
          description: "ISO 8601 start time (e.g., 2026-03-01T10:00:00Z).",
        }),
        endTime: Type.String({ description: "ISO 8601 end time." }),
        scope: Type.Optional(
          Type.Unsafe<string>({
            type: "string",
            enum: ["PUBLIC", "PRIVATE"],
            description: "Defaults to PUBLIC.",
          }),
        ),
        recurrence: Type.Optional(
          Type.Object(
            {
              frequency: Type.Unsafe<string>({
                type: "string",
                enum: ["daily", "weekly", "monthly", "yearly"],
                description: "How often the event repeats.",
              }),
              until: Type.Optional(
                Type.String({
                  description: "ISO date to stop recurring (e.g., 2030-12-31T00:00:00Z).",
                }),
              ),
              count: Type.Optional(
                Type.Number({
                  description: "Max number of occurrences. Default: unlimited (up to 100).",
                }),
              ),
            },
            { description: "Recurrence rule for repeating events." },
          ),
        ),
      }),
      execute: async (args: any) => {
        const event = calendar.createEvent({
          title: args.title,
          description: args.description,
          startTime: args.startTime,
          endTime: args.endTime,
          scope: args.scope || "PUBLIC",
          ownerId: userId,
          recurrence: args.recurrence || undefined,
        });
        const recurrenceInfo = event.recurrence ? ` (recurring ${event.recurrence.frequency})` : "";
        return `Created event ${event.id}${recurrenceInfo}`;
      },
    },
    {
      name: "calendar_list",
      label: "List Calendar Events",
      description: "Lists upcoming calendar events.",
      parameters: Type.Object({
        scope: Type.Optional(Type.Unsafe<string>({ type: "string", enum: ["PUBLIC", "PRIVATE"] })),
      }),
      execute: async (args: any) => {
        const events = calendar.listEvents(userId, args.scope || "PUBLIC");
        return events.length > 0 ? JSON.stringify(events, null, 2) : "No events found.";
      },
    },
  ];
};
