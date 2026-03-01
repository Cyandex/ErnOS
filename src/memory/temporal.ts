/**
 * TemporalTracker — Ernos's sense of time.
 *
 * Ported from V3 (Ernos 3.0/src/memory/temporal.py).
 *
 * Tracks:
 *   - Project development duration (live timer from inception)
 *   - Birthdate (first boot timestamp, persisted forever)
 *   - Current uptime (since last boot)
 *   - Last downtime (gap between previous shutdown and current boot)
 *   - Total boot count + cumulative uptime
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { STATE_DIR } from "../config/paths.js";

// ── Constants ──────────────────────────────────────────────
const STATE_FILE = join(STATE_DIR, "memory", "core", "temporal_state.json");

/** When prototyping began on the current Ernos codebase. Fixed anchor. */
const PROTOTYPING_START = new Date("2025-08-14T00:00:00Z");

/** The very first echo — when the original Ernos first spoke. June 2024. */
const FIRST_ECHO = new Date("2024-06-28T00:00:00Z");

// ── Helpers ────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (seconds < 0) return "0s";

  const totalDays = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (totalDays > 0) {
    const years = Math.floor(totalDays / 365);
    const remainingDays = totalDays % 365;
    const months = Math.floor(remainingDays / 30);
    const leftoverDays = remainingDays % 30;
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}mo`);
    if (leftoverDays > 0) parts.push(`${leftoverDays}d`);
  }
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTimeFull(isoString: string): string {
  try {
    const dt = new Date(isoString);
    return dt.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}

// ── State Shape ────────────────────────────────────────────
interface TemporalState {
  birthdate?: string;
  last_boot?: string;
  last_shutdown?: string;
  last_downtime_seconds?: number;
  total_boots?: number;
  total_uptime_seconds?: number;
}

// ── Core Class ─────────────────────────────────────────────
export class TemporalTracker {
  private bootTime: number;
  private bootDt: Date;
  private state: TemporalState;

  constructor(registerBoot = false) {
    this.bootTime = Date.now();
    this.bootDt = new Date();
    this.state = this.loadState();
    if (registerBoot) {
      this.registerBoot();
    }
  }

  private loadState(): TemporalState {
    try {
      if (existsSync(STATE_FILE)) {
        return JSON.parse(readFileSync(STATE_FILE, "utf8")) as TemporalState;
      }
    } catch {
      // Corrupt or missing — start fresh
    }
    return {};
  }

  private saveState(): void {
    try {
      mkdirSync(dirname(STATE_FILE), { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {
      // Non-fatal — log or ignore
    }
  }

  private registerBoot(): void {
    const nowIso = this.bootDt.toISOString();

    // Birthdate: set once, never overwritten
    if (!this.state.birthdate) {
      this.state.birthdate = nowIso;
    }

    // Calculate downtime (gap since last shutdown)
    const lastShutdown = this.state.last_shutdown;
    if (lastShutdown) {
      try {
        const shutdownDt = new Date(lastShutdown);
        const gap = (this.bootDt.getTime() - shutdownDt.getTime()) / 1000;
        this.state.last_downtime_seconds = Math.max(0, gap);
      } catch {
        this.state.last_downtime_seconds = 0;
      }
    }

    // Record current boot
    this.state.last_boot = nowIso;
    this.state.total_boots = (this.state.total_boots ?? 0) + 1;
    this.saveState();
  }

  /** Call on graceful shutdown. */
  recordShutdown(): void {
    const nowIso = new Date().toISOString();
    this.state.last_shutdown = nowIso;

    const sessionSeconds = (Date.now() - this.bootTime) / 1000;
    const total = (this.state.total_uptime_seconds ?? 0) + sessionSeconds;
    this.state.total_uptime_seconds = total;

    this.saveState();
  }

  // ── Accessors ──────────────────────────────────────────
  getPrototypingAge(): string {
    const delta = (Date.now() - PROTOTYPING_START.getTime()) / 1000;
    return formatDuration(delta);
  }

  getPrototypingDate(): string {
    return formatDate(PROTOTYPING_START);
  }

  getFirstEchoAge(): string {
    const delta = (Date.now() - FIRST_ECHO.getTime()) / 1000;
    return formatDuration(delta);
  }

  getFirstEchoDate(): string {
    return formatDate(FIRST_ECHO);
  }

  getBirthdate(): string {
    const bd = this.state.birthdate;
    if (bd) return formatDateTimeFull(bd);
    return "Unknown";
  }

  getUptime(): string {
    const elapsed = (Date.now() - this.bootTime) / 1000;
    return formatDuration(elapsed);
  }

  getLastDowntime(): string {
    const seconds = this.state.last_downtime_seconds ?? 0;
    if (seconds <= 0) return "No previous downtime recorded";
    return formatDuration(seconds);
  }

  getTotalBoots(): number {
    return this.state.total_boots ?? 1;
  }

  getTotalUptime(): string {
    let total = this.state.total_uptime_seconds ?? 0;
    total += (Date.now() - this.bootTime) / 1000;
    return formatDuration(total);
  }

  // ── HUD Formatter ──────────────────────────────────────
  getFormattedHud(): string {
    // Compute birthdate age live
    let birthAge = "Unknown";
    const bd = this.state.birthdate;
    if (bd) {
      try {
        const dt = new Date(bd);
        const delta = (Date.now() - dt.getTime()) / 1000;
        birthAge = formatDuration(delta);
      } catch {
        // ignore
      }
    }

    return [
      "## TEMPORAL AWARENESS (all values are live)",
      `🔊 Time since first echo: ${this.getFirstEchoAge()} (since ${this.getFirstEchoDate()})`,
      `📅 Time since prototyping began: ${this.getPrototypingAge()} (since ${this.getPrototypingDate()})`,
      `🎂 Age since first boot: ${birthAge} (born ${this.getBirthdate()})`,
      `🟢 Current session uptime: ${this.getUptime()}`,
      `⏸️  Last downtime duration: ${this.getLastDowntime()}`,
      `📊 Lifetime cumulative uptime: ${this.getTotalUptime()}`,
      `🔄 Total boot count: ${this.getTotalBoots()}`,
    ].join("\n");
  }
}

// ── Singleton ────────────────────────────────────────────
let _instance: TemporalTracker | undefined;

/** Get or create the global TemporalTracker (registers boot on first call). */
export function getTemporalTracker(): TemporalTracker {
  if (!_instance) {
    _instance = new TemporalTracker(true);
  }
  return _instance;
}

/** Reset singleton (for testing). */
export function _resetTemporalTracker(): void {
  _instance = undefined;
}

// Export for testing
export { formatDuration as _formatDuration, STATE_FILE as _STATE_FILE };
