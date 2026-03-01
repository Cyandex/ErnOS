import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  /** ISO date string — stop generating instances after this date. */
  until?: string;
  /** Maximum number of occurrences (including the original). */
  count?: number;
};

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  ownerId: string;
  scope: "PRIVATE" | "PUBLIC";
  recurrence?: RecurrenceRule;
}

export class CalendarSystem {
  private events: Map<string, CalendarEvent>;
  private persistPath: string;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "calendar.json")) {
    this.persistPath = persistPath;
    this.events = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          this.events.set(k, v as CalendarEvent);
        }
      }
    } catch (e) {
      console.warn(`[Calendar] Load failed: ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(Object.fromEntries(this.events), null, 2));
    } catch (e) {
      console.error(`[Calendar] Save failed: ${e}`);
    }
  }

  public createEvent(data: Omit<CalendarEvent, "id">): CalendarEvent {
    const id = `evt_${randomUUID()}`;
    const event: CalendarEvent = { ...data, id };
    this.events.set(id, event);
    this.saveToDisk();
    return event;
  }

  public listEvents(userId: string, scope: "PRIVATE" | "PUBLIC" = "PUBLIC"): CalendarEvent[] {
    const base = Array.from(this.events.values()).filter((e) => {
      if (e.scope === "PUBLIC") return true;
      return e.ownerId === userId && e.scope === scope;
    });

    // Expand recurring events into upcoming instances
    const expanded: CalendarEvent[] = [];
    const now = new Date();
    const horizon = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

    for (const event of base) {
      expanded.push(event);
      if (!event.recurrence) continue;

      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const durationMs = end.getTime() - start.getTime();
      const until = event.recurrence.until ? new Date(event.recurrence.until) : horizon;
      const maxCount = event.recurrence.count ?? 100;
      let instanceCount = 1;

      let cursor = new Date(start);
      while (instanceCount < maxCount) {
        cursor = this.advanceDate(cursor, event.recurrence.frequency);
        if (cursor > until || cursor > horizon) break;
        instanceCount++;

        const instanceStart = cursor.toISOString();
        const instanceEnd = new Date(cursor.getTime() + durationMs).toISOString();
        expanded.push({
          ...event,
          id: `${event.id}:r${instanceCount}`,
          startTime: instanceStart,
          endTime: instanceEnd,
        });
      }
    }

    return expanded.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }

  private advanceDate(date: Date, frequency: RecurrenceRule["frequency"]): Date {
    const next = new Date(date);
    switch (frequency) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  public updateEvent(id: string, updates: Partial<CalendarEvent>): CalendarEvent | null {
    const event = this.events.get(id);
    if (!event) return null;
    Object.assign(event, updates);
    this.saveToDisk();
    return event;
  }

  public deleteEvent(id: string): boolean {
    const res = this.events.delete(id);
    if (res) this.saveToDisk();
    return res;
  }
}

export const calendar = new CalendarSystem();
