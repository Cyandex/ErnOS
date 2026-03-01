/**
 * HUD Data Loader — populates the HudData interface with live runtime data.
 *
 * This is the bridge between runtime data sources and the HUD renderer.
 * Each field in HudData is populated from the best available source.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "../../config/paths.js";
import { getRecentThoughts } from "../../cron/autonomy-log-buffer.js";
import { diagnosticSessionStates } from "../../logging/diagnostic-session-state.js";
import { getRecentErrors } from "../../logging/error-buffer.js";
import { getEmotionalTracker } from "../../memory/emotional.js";
import { goals } from "../../memory/goals.js";
import { getTemporalTracker } from "../../memory/temporal.js";
import type { HudData } from "./ernos-hud.js";

// ── Paths ──────────────────────────────────────────────────
const LESSONS_PATH = join(STATE_DIR, "memory", "core", "lessons.json");
const WORKING_MEMORY_PATH = join(STATE_DIR, "memory", "core", "working_memory.jsonl");
const TAPE_DIR = join(STATE_DIR, "memory", "tape");

/**
 * Load all available HUD data from live runtime sources.
 * Returns a populated HudData object for injection into the system prompt.
 */
export function loadHudData(): HudData {
  const data: HudData = {};

  // ── §1 Temporal Context ───────────────────────────────
  try {
    const temporal = getTemporalTracker();
    data.temporalContext = temporal.getFormattedHud();
  } catch {
    // Non-fatal
  }

  // ── §2 Inner State (Emotional PAD Model) ──────────────
  try {
    const emotional = getEmotionalTracker();
    data.innerState = emotional.getFormattedState();
  } catch {
    // Non-fatal
  }

  // ── §3 Subsystem Health (Dynamic) ─────────────────────
  try {
    const health: Record<string, "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN"> = {};

    // Memory subsystem
    health.Memory = existsSync(join(STATE_DIR, "memory")) ? "ONLINE" : "DEGRADED";

    // KG (Neo4j)
    if (process.env.DISABLE_NEO4J === "true") {
      health.KnowledgeGraph = "OFFLINE";
    } else if (process.env.NEO4J_URI || process.env.NEO4J_PASSWORD) {
      health.KnowledgeGraph = "ONLINE";
    } else {
      health.KnowledgeGraph = "UNKNOWN";
    }

    // TTS
    if (process.env.TTS_PROVIDER || process.env.KOKORO_URL) {
      health.TTS = "ONLINE";
    } else {
      health.TTS = "UNKNOWN";
    }

    // Autonomy
    const thoughts = getRecentThoughts(1);
    health.Autonomy = thoughts.length > 0 ? "ONLINE" : "UNKNOWN";

    data.subsystemHealth = health;
  } catch {
    // Non-fatal
  }

  // ── §4 Recent Errors ──────────────────────────────────
  try {
    const errors = getRecentErrors(10);
    if (errors.length > 0) {
      data.recentErrors = errors;
    }
  } catch {
    // Non-fatal
  }

  // ── §5 Crystallized Lessons ───────────────────────────
  try {
    if (existsSync(LESSONS_PATH)) {
      const raw = JSON.parse(readFileSync(LESSONS_PATH, "utf8"));
      // LessonManager stores as { id: { topic, lesson, ... } }
      const lessons: string[] = [];
      if (typeof raw === "object" && raw !== null) {
        for (const [, value] of Object.entries(raw)) {
          const v = value as { lesson?: string; topic?: string };
          if (v.lesson) {
            const prefix = v.topic ? `[${v.topic}] ` : "";
            lessons.push(`${prefix}${v.lesson}`);
          }
        }
      }
      if (lessons.length > 0) {
        data.lessons = lessons.slice(-15);
      }
    }
  } catch {
    // Non-fatal
  }

  // ── §6 Autonomy Log ───────────────────────────────────
  try {
    const thoughts = getRecentThoughts(10);
    if (thoughts.length > 0) {
      data.autonomyLog = thoughts;
    }
  } catch {
    // Non-fatal
  }

  // ── §7 Working Memory Summary ─────────────────────────
  try {
    if (existsSync(WORKING_MEMORY_PATH)) {
      const content = readFileSync(WORKING_MEMORY_PATH, "utf8");
      const lines = content.split("\n").filter(Boolean);
      const lastLines = lines.slice(-5);
      const summaryParts: string[] = [];

      for (const line of lastLines) {
        try {
          const turn = JSON.parse(line) as {
            userName?: string;
            userMessage?: string;
            timestamp?: number;
          };
          const name = turn.userName ?? "Unknown";
          const msg = (turn.userMessage ?? "").slice(0, 100);
          const ts = turn.timestamp
            ? new Date(turn.timestamp).toISOString().slice(11, 16)
            : "??:??";
          summaryParts.push(`[${ts}] ${name}: ${msg}`);
        } catch {
          // skip malformed lines
        }
      }

      if (summaryParts.length > 0) {
        data.workingMemorySummary = summaryParts.join("\n");
      }
    }
  } catch {
    // Non-fatal
  }

  // ── §8 Tape State ─────────────────────────────────────
  try {
    // Check if system tape exists
    const systemTapePath = join(TAPE_DIR, "system", "tape.json");
    if (existsSync(systemTapePath)) {
      const raw = JSON.parse(readFileSync(systemTapePath, "utf8"));
      const cellCount = raw.cells
        ? Array.isArray(raw.cells)
          ? raw.cells.length
          : Object.keys(raw.cells).length
        : 0;
      const head = raw.head ?? raw.focusPointer ?? { x: 0, y: 0, z: 0 };
      const hx = head.x ?? head[0] ?? 0;
      const hy = head.y ?? head[1] ?? 0;
      const hz = head.z ?? head[2] ?? 0;
      data.tapeState = `Execution Head: [${hx},${hy},${hz}] | Total cells: ${cellCount}`;
    }
  } catch {
    // Non-fatal
  }

  // ── §9 Tool Call History ──────────────────────────────
  try {
    const allCalls: string[] = [];

    for (const session of diagnosticSessionStates.values()) {
      const history = session.toolCallHistory ?? [];
      for (const call of history.slice(-10)) {
        const ts = new Date(call.timestamp).toISOString().slice(11, 19);
        allCalls.push(`[${ts}] ${call.toolName}`);
      }
    }

    // Sort by timestamp (embedded in string) and take last 20
    if (allCalls.length > 0) {
      data.toolCallHistory = allCalls.sort().slice(-20);
    }
  } catch {
    // Non-fatal
  }

  // ── §10 Room Roster ───────────────────────────────────
  try {
    if (existsSync(WORKING_MEMORY_PATH)) {
      const content = readFileSync(WORKING_MEMORY_PATH, "utf8");
      const lines = content.split("\n").filter(Boolean);

      // Extract unique users + last seen from working memory turns
      const userMap = new Map<string, { name: string; lastSeen: number }>();

      for (const line of lines) {
        try {
          const turn = JSON.parse(line) as {
            userId?: string;
            userName?: string;
            timestamp?: number;
          };
          if (turn.userId) {
            const existing = userMap.get(turn.userId);
            const ts = turn.timestamp ?? 0;
            if (!existing || ts > existing.lastSeen) {
              userMap.set(turn.userId, {
                name: turn.userName ?? "[Unknown User]",
                lastSeen: ts,
              });
            }
          }
        } catch {
          // skip
        }
      }

      if (userMap.size > 0) {
        data.roomRoster = Array.from(userMap.entries())
          .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
          .slice(0, 20)
          .map(([userId, info]) => ({
            userId,
            name: info.name,
            lastSeen: new Date(info.lastSeen).toISOString(),
          }));
      }
    }
  } catch {
    // Non-fatal
  }

  // ── §11 KG Snapshot ───────────────────────────────────
  // KG requires async Neo4j queries — read from cache file if available
  try {
    const kgCachePath = join(STATE_DIR, "memory", "core", "kg_recent_cache.json");
    if (existsSync(kgCachePath)) {
      const raw = JSON.parse(readFileSync(kgCachePath, "utf8"));
      if (Array.isArray(raw) && raw.length > 0) {
        data.kgSnapshot = raw
          .slice(0, 20)
          .map((triple: { subject?: string; predicate?: string; object?: string }) => ({
            subject: triple.subject ?? "?",
            predicate: triple.predicate ?? "?",
            object: triple.object ?? "?",
          }));
      }
    }
  } catch {
    // Non-fatal
  }

  // ── §12 Goals ─────────────────────────────────────────
  try {
    const active = goals.getActiveGoals();
    if (active.length > 0) {
      data.activeGoals = active.map((g) => `[${g.progress}%] ${g.title}: ${g.description}`);
    }
  } catch {
    // Non-fatal
  }

  return data;
}
