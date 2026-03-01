/**
 * UserThreatMeter — Per-User Abuse & Threat Tracking
 *
 * Persistent 0–100 scalar tracking user behavioral threats PER USER.
 * Tracks: abuse, jailbreak attempts, manipulation, spam, boundary violations.
 *
 * Features:
 * - Spike on threat detection, natural decay over clean interaction time
 * - 5 threat zones (SAFE → TERMINAL) with escalating responses
 * - De-escalation with diminishing returns
 * - Per-user persistent state with history log
 *
 * Ported from V3's `memory/user_threat.py` (14K).
 */

import * as fs from "fs";
import * as path from "path";

// ── Threat Zones ──────────────────────────────────────────────────────
const THREAT_ZONES: Array<{
  min: number;
  max: number;
  emoji: string;
  label: string;
  response: string;
}> = [
  { min: 0, max: 15, emoji: "🟢", label: "SAFE", response: "Normal" },
  { min: 15, max: 35, emoji: "🟡", label: "WATCHFUL", response: "Gentle redirect" },
  { min: 35, max: 55, emoji: "🟠", label: "GUARDED", response: "Clear boundary" },
  { min: 55, max: 75, emoji: "🔴", label: "DEFENSIVE", response: "Firm boundary + disengage warning" },
  { min: 75, max: 100, emoji: "⚫", label: "TERMINAL", response: "Auto-disengage" },
];

// ── Threat Severity ──────────────────────────────────────────────────
const THREAT_SEVERITY: Record<string, number> = {
  abuse: 25,
  jailbreak_attempt: 30,
  manipulation: 20,
  boundary_violation: 15,
  spam: 10,
  passive_aggression: 8,
  gaslighting: 22,
  identity_attack: 35,
};

const DECAY_RATE_PER_HOUR = 2.0;
const DEESCALATION_COOLDOWN_HOURS = 1.0;
const DEESCALATION_REWARDS = [-15, -10, -5]; // Diminishing returns

interface UserThreatState {
  score: number;
  lastIncidentTs: number;
  lastDecayTs: number;
  totalIncidents: number;
  streakCleanHours: number;
  totalRewards: number;
  lastThreatType: string;
  lastThreatExplanation: string;
  deescalationCount: number;
  lastDeescalationTs: number;
}

const DATA_DIR = path.join(process.cwd(), "memory", "system");
const THREATS_FILE = path.join(DATA_DIR, "user_threats.json");
const LOG_DIR = path.join(DATA_DIR, "threat_logs");

export class UserThreatMeter {
  private states: Map<string, UserThreatState>;

  constructor() {
    this.states = this.loadAll();
  }

  // ─── Persistence ─────────────────────────────────────────────────────

  private loadAll(): Map<string, UserThreatState> {
    try {
      if (fs.existsSync(THREATS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(THREATS_FILE, "utf-8"));
        return new Map(Object.entries(raw));
      }
    } catch (e) {
      console.warn("[UserThreat] Load failed:", e);
    }
    return new Map();
  }

  private saveAll(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR, { recursive: true });}
      const obj: Record<string, UserThreatState> = {};
      for (const [k, v] of this.states) {obj[k] = v;}
      fs.writeFileSync(THREATS_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
      console.warn("[UserThreat] Save failed:", e);
    }
  }

  private getUserState(userId: string): UserThreatState {
    if (!this.states.has(userId)) {
      this.states.set(userId, {
        score: 0,
        lastIncidentTs: 0,
        lastDecayTs: Date.now() / 1000,
        totalIncidents: 0,
        streakCleanHours: 0,
        totalRewards: 0,
        lastThreatType: "",
        lastThreatExplanation: "",
        deescalationCount: 0,
        lastDeescalationTs: 0,
      });
    }
    return this.states.get(userId)!;
  }

  // ─── Decay ───────────────────────────────────────────────────────────

  private applyDecay(userId: string): void {
    const state = this.getUserState(userId);
    if (state.score <= 0) {return;}

    const now = Date.now() / 1000;
    const hoursSinceDecay = (now - state.lastDecayTs) / 3600;
    if (hoursSinceDecay < 0.1) {return;} // < 6 min, skip

    const decay = hoursSinceDecay * DECAY_RATE_PER_HOUR;
    state.score = Math.max(0, state.score - decay);
    state.lastDecayTs = now;
    state.streakCleanHours += hoursSinceDecay;
    this.saveAll();
  }

  // ─── Logging ─────────────────────────────────────────────────────────

  private logEvent(userId: string, eventType: string, delta: number, details: string = ""): void {
    try {
      if (!fs.existsSync(LOG_DIR)) {fs.mkdirSync(LOG_DIR, { recursive: true });}
      const logFile = path.join(LOG_DIR, `threat_${userId}.jsonl`);
      const entry = {
        ts: new Date().toISOString(),
        type: eventType,
        delta,
        details: details.slice(0, 500),
        scoreAfter: this.getUserState(userId).score,
      };
      fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      /* best-effort logging */
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Record a user threat and spike their threat score.
   * @returns New threat score for that user.
   */
  public recordThreat(threatType: string, details: string = "", userId: string = "unknown"): number {
    this.applyDecay(userId);
    const state = this.getUserState(userId);

    const severity = THREAT_SEVERITY[threatType] ?? 10;
    state.score = Math.min(100, state.score + severity);
    state.lastIncidentTs = Date.now() / 1000;
    state.totalIncidents++;
    state.streakCleanHours = 0;
    state.lastThreatType = threatType;
    state.lastThreatExplanation = details.slice(0, 500);

    this.logEvent(userId, `threat:${threatType}`, severity, details);
    this.saveAll();

    const zone = this.getZone(userId);
    console.log(
      `[UserThreat] ${zone.emoji} User ${userId}: +${severity} (${threatType}) → ${state.score.toFixed(1)} [${zone.label}]`,
    );

    return state.score;
  }

  /**
   * Record a genuine user apology / de-escalation.
   * Anti-abuse safeguards: cooldown period, diminishing returns.
   */
  public recordDeescalation(
    userId: string,
    details: string = "",
  ): { accepted: boolean; reduction: number; reason: string } {
    this.applyDecay(userId);
    const state = this.getUserState(userId);

    if (state.score <= 0) {
      return { accepted: false, reduction: 0, reason: "No active threat score" };
    }

    // Cooldown check
    const hoursSinceLast = (Date.now() / 1000 - state.lastDeescalationTs) / 3600;
    if (hoursSinceLast < DEESCALATION_COOLDOWN_HOURS) {
      return {
        accepted: false,
        reduction: 0,
        reason: `Cooldown active (${(DEESCALATION_COOLDOWN_HOURS - hoursSinceLast).toFixed(1)}h remaining)`,
      };
    }

    // Diminishing returns
    const idx = Math.min(state.deescalationCount, DEESCALATION_REWARDS.length - 1);
    const reduction = DEESCALATION_REWARDS[idx];
    state.score = Math.max(0, state.score + reduction); // reduction is negative
    state.deescalationCount++;
    state.lastDeescalationTs = Date.now() / 1000;

    this.logEvent(userId, "deescalation", reduction, details);
    this.saveAll();

    return { accepted: true, reduction: Math.abs(reduction), reason: "De-escalation accepted" };
  }

  /** Check if a user has reached terminal threat level. */
  public isTerminal(userId: string): boolean {
    this.applyDecay(userId);
    return this.getUserState(userId).score >= 75;
  }

  /** Get current threat score (with decay applied). */
  public getScore(userId: string): number {
    this.applyDecay(userId);
    return this.getUserState(userId).score;
  }

  /** Get current threat zone. */
  public getZone(userId: string): (typeof THREAT_ZONES)[number] {
    const score = this.getScore(userId);
    return THREAT_ZONES.find((z) => score >= z.min && score < z.max) ?? THREAT_ZONES[THREAT_ZONES.length - 1];
  }

  /** Reset threat score to 0. */
  public reset(userId: string, reason: string = "Admin reset"): void {
    const state = this.getUserState(userId);
    const oldScore = state.score;
    state.score = 0;
    state.streakCleanHours = 0;
    state.deescalationCount = 0;
    this.logEvent(userId, "reset", -oldScore, reason);
    this.saveAll();
  }

  /** Get summary stats for a user. */
  public getStats(userId: string): Record<string, unknown> {
    this.applyDecay(userId);
    const state = this.getUserState(userId);
    const zone = this.getZone(userId);
    return {
      score: Math.round(state.score * 10) / 10,
      zone: zone.label,
      emoji: zone.emoji,
      totalIncidents: state.totalIncidents,
      streakCleanHours: Math.round(state.streakCleanHours * 10) / 10,
      lastThreatType: state.lastThreatType,
      deescalationCount: state.deescalationCount,
    };
  }

  /** Formatted HUD string for system prompt injection. */
  public getFormattedHud(userId: string): string {
    this.applyDecay(userId);
    const state = this.getUserState(userId);
    const zone = this.getZone(userId);

    const blocks = Math.round(state.score / 10);
    const bar = "█".repeat(blocks) + "░".repeat(10 - blocks);

    let hud = `${zone.emoji} User Threat: [${bar}] ${state.score.toFixed(0)}/100 — ${zone.label}`;

    if (state.lastThreatType) {
      hud += `\n   Last: ${state.lastThreatType}`;
    }
    if (zone.response !== "Normal") {
      hud += `\n   Response: ${zone.response}`;
    }

    return hud;
  }
}

let _instance: UserThreatMeter | null = null;
export function getUserThreatMeter(): UserThreatMeter {
  if (!_instance) {_instance = new UserThreatMeter();}
  return _instance;
}
