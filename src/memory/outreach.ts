/**
 * OutreachManager — Per-user proactive messaging system.
 *
 * Ported from V3 (Ernos 3.0/src/memory/outreach.py).
 *
 * Each user has independent outreach settings:
 *   - policy: "public" | "private" | "both" | "none"
 *   - frequency: "low" (24h) | "medium" (12h) | "high" (3h) | "unlimited"
 *   - lastOutreach: ISO timestamp of last outreach
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { STATE_DIR } from "../config/paths.js";

// ────── Types ──────

export type OutreachPolicy = "public" | "private" | "both" | "none";
export type OutreachFrequency = "low" | "medium" | "high" | "unlimited";

export interface OutreachUserSettings {
  policy: OutreachPolicy;
  frequency: OutreachFrequency;
  lastOutreach: string | null; // ISO timestamp
}

export interface OutreachCheckResult {
  allowed: boolean;
  reason: string;
}

// ────── Constants ──────

/** Hours between outreach for each frequency tier. */
export const FREQUENCY_HOURS: Record<OutreachFrequency, number> = {
  low: 24,
  medium: 12,
  high: 3,
  unlimited: 0,
};

export const VALID_POLICIES = new Set<OutreachPolicy>(["public", "private", "both", "none"]);

export const VALID_FREQUENCIES = new Set<OutreachFrequency>(["low", "medium", "high", "unlimited"]);

const DEFAULT_SETTINGS: OutreachUserSettings = {
  policy: "private",
  frequency: "medium",
  lastOutreach: null,
};

// ────── Persistence ──────

type OutreachStore = Record<string, OutreachUserSettings>;

function resolveOutreachStorePath(): string {
  return path.join(STATE_DIR, "memory", "outreach", "settings.json");
}

function loadStore(storePath?: string): OutreachStore {
  const p = storePath ?? resolveOutreachStorePath();
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as OutreachStore;
    }
  } catch {
    // Corrupted file — start fresh
  }
  return {};
}

function saveStore(store: OutreachStore, storePath?: string): void {
  const p = storePath ?? resolveOutreachStorePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}

// ────── OutreachManager ──────

export class OutreachManager {
  private storePath: string;

  constructor(storePath?: string) {
    this.storePath = storePath ?? resolveOutreachStorePath();
  }

  // ── Settings ──

  getSettings(userId: string): OutreachUserSettings {
    const store = loadStore(this.storePath);
    return store[userId] ?? { ...DEFAULT_SETTINGS };
  }

  getAllSettings(): OutreachStore {
    return loadStore(this.storePath);
  }

  setPolicy(userId: string, policy: OutreachPolicy): string {
    if (!VALID_POLICIES.has(policy)) {
      return `❌ Invalid policy. Use: ${[...VALID_POLICIES].join(", ")}`;
    }
    const store = loadStore(this.storePath);
    const settings = store[userId] ?? { ...DEFAULT_SETTINGS };
    settings.policy = policy;
    store[userId] = settings;
    saveStore(store, this.storePath);
    return `✅ Outreach policy for user ${userId} set to '${policy}'.`;
  }

  setFrequency(userId: string, frequency: OutreachFrequency): string {
    if (!VALID_FREQUENCIES.has(frequency)) {
      return `❌ Invalid frequency. Use: ${[...VALID_FREQUENCIES].join(", ")}`;
    }
    const store = loadStore(this.storePath);
    const settings = store[userId] ?? { ...DEFAULT_SETTINGS };
    settings.frequency = frequency;
    store[userId] = settings;
    saveStore(store, this.storePath);
    const hours = FREQUENCY_HOURS[frequency];
    const desc = hours > 0 ? `${hours}h between messages` : "no limit";
    return `✅ Outreach frequency for user ${userId} set to '${frequency}' (${desc}).`;
  }

  // ── Timing Check ──

  canOutreach(userId: string): OutreachCheckResult {
    const settings = this.getSettings(userId);

    // Policy check
    if (settings.policy === "none") {
      return { allowed: false, reason: "Outreach disabled for this user" };
    }

    // Unlimited frequency — always OK
    if (settings.frequency === "unlimited") {
      return { allowed: true, reason: "User allows unlimited outreach" };
    }

    // First outreach — always OK
    if (!settings.lastOutreach) {
      return { allowed: true, reason: "First outreach to this user" };
    }

    // Time-based check
    try {
      const last = new Date(settings.lastOutreach).getTime();
      const nowMs = Date.now();
      const hoursSince = (nowMs - last) / (1000 * 60 * 60);
      const minHours = FREQUENCY_HOURS[settings.frequency];

      if (hoursSince < minHours) {
        const remaining = (minHours - hoursSince).toFixed(1);
        return {
          allowed: false,
          reason: `Too soon — wait ${remaining}h more (frequency: ${settings.frequency}, ${minHours}h between messages)`,
        };
      }

      return {
        allowed: true,
        reason: `${hoursSince.toFixed(1)}h since last outreach (threshold: ${minHours}h)`,
      };
    } catch {
      // Bad timestamp — allow as fallback
      return { allowed: true, reason: "OK (timestamp parse fallback)" };
    }
  }

  // ── Recording ──

  recordOutreach(userId: string): void {
    const store = loadStore(this.storePath);
    const settings = store[userId] ?? { ...DEFAULT_SETTINGS };
    settings.lastOutreach = new Date().toISOString();
    store[userId] = settings;
    saveStore(store, this.storePath);
  }
}
