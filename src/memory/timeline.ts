/**
 * Timeline — Immutable Chronological Event Log
 *
 * Append-only JSONL log of events with scope-aware dual-write:
 * - Global timeline (excludes PRIVATE events)
 * - Per-user silo timelines
 *
 * Used for: auditing, autobiographical memory, event recall.
 *
 * Ported from V3: src/memory/timeline.py (106 lines)
 */

import * as fs from "fs";
import * as path from "path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("timeline");

const DEFAULT_TIMELINE_PATH = "memory/public/timeline.jsonl";

export interface TimelineEvent {
  timestamp: string;
  type: string;
  description: string;
  scope: string;
  userId?: string;
  userName?: string;
  importance: number;
  metadata: Record<string, any>;
}

export class Timeline {
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || DEFAULT_TIMELINE_PATH;
    // Ensure directory exists
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Append event to timeline log. Writes to Global + User Silo.
   * PRIVATE events are skipped in the global timeline to prevent leaks.
   */
  public addEvent(
    eventType: string,
    description: string,
    scope: string = "PUBLIC",
    userId?: string,
    userName?: string,
    importance: number = 0.0,
    metadata: Record<string, any> = {},
  ): void {
    const entry: TimelineEvent = {
      timestamp: new Date().toISOString(),
      type: eventType,
      description,
      scope: scope.toUpperCase(),
      userId,
      userName,
      importance,
      metadata,
    };

    const line = JSON.stringify(entry) + "\n";
    const scopeUpper = scope.toUpperCase();

    // 1. Global Write (SKIP PRIVATE to prevent leaks)
    if (scopeUpper !== "PRIVATE") {
      try {
        fs.appendFileSync(this.logPath, line, "utf-8");
      } catch (err) {
        log.warn(`Failed to write to global timeline: ${err}`);
      }
    }

    // 2. User Silo Write
    if (userId) {
      try {
        const userSiloDir =
          scopeUpper === "PRIVATE" || scopeUpper === "CORE" || scopeUpper === "CORE_PRIVATE"
            ? path.join("memory", "private", `user_${userId}`)
            : path.join("memory", "public", `user_${userId}`);

        if (!fs.existsSync(userSiloDir)) {
          fs.mkdirSync(userSiloDir, { recursive: true });
        }

        fs.appendFileSync(path.join(userSiloDir, "timeline.jsonl"), line, "utf-8");
      } catch (err) {
        log.warn(`Failed to write to user silo ${userId}: ${err}`);
      }
    }
  }

  /**
   * Get recent events, filtered by scope.
   * Reads from the global timeline by default.
   */
  public getRecentEvents(limit: number = 10, scope: string = "PUBLIC"): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (!fs.existsSync(this.logPath)) return events;

    try {
      const content = fs.readFileSync(this.logPath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      // Read from end for recency
      for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
        try {
          const data = JSON.parse(lines[i]) as TimelineEvent;
          // Scope filtering: PUBLIC scope can see PUBLIC events,
          // PRIVATE scope can see all events
          const rowScope = (data.scope || "PUBLIC").toUpperCase();
          const targetScope = scope.toUpperCase();

          if (targetScope === "PRIVATE" || rowScope === "PUBLIC" || rowScope === targetScope) {
            events.push(data);
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      log.warn(`Error reading timeline: ${err}`);
    }

    return events;
  }

  /**
   * Get events for a specific user from their silo.
   */
  public getUserEvents(
    userId: string,
    limit: number = 10,
    scope: string = "PRIVATE",
  ): TimelineEvent[] {
    const scopeUpper = scope.toUpperCase();
    const siloDir =
      scopeUpper === "PRIVATE"
        ? path.join("memory", "private", `user_${userId}`)
        : path.join("memory", "public", `user_${userId}`);
    const siloPath = path.join(siloDir, "timeline.jsonl");

    if (!fs.existsSync(siloPath)) return [];

    const events: TimelineEvent[] = [];
    try {
      const lines = fs.readFileSync(siloPath, "utf-8").trim().split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
        try {
          events.push(JSON.parse(lines[i]));
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      log.warn(`Error reading user timeline for ${userId}: ${err}`);
    }

    return events;
  }
}
