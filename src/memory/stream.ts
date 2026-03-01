/**
 * ContextStream + StateVector — Rolling Episodic State
 *
 * Maintains a synthesized "current state" narrative per scope+user combination.
 * The StateVector summarizes the ongoing situation (topics, participants, goals)
 * and is updated via LLM after each turn.
 *
 * This provides the "what's happening right now" context that bridges working
 * memory (raw turns) with long-term knowledge (KG/lessons).
 *
 * Ported from V3: src/memory/stream.py (280 lines)
 */

import * as fs from "fs";
import * as path from "path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { memoryLLMGenerate } from "./memory-llm.js";

const log = createSubsystemLogger("context-stream");

const STREAM_PERSIST_DIR = "memory/state-vectors";

// ─── StateVector ────────────────────────────────────────────────────────

/** Synthesized narrative of the current conversational state. */
export interface StateVector {
  /** Human-readable summary of the current situation */
  summary: string;
  /** Active topics being discussed */
  topics: string[];
  /** Active participants */
  participants: string[];
  /** Current goals or objectives */
  goals: string[];
  /** Emotional tone (neutral, positive, tense, etc.) */
  tone: string;
  /** Last update timestamp */
  lastUpdated: number;
  /** Number of turns processed into this state */
  turnCount: number;
}

function emptyStateVector(): StateVector {
  return {
    summary: "No conversation history yet.",
    topics: [],
    participants: [],
    goals: [],
    tone: "neutral",
    lastUpdated: Date.now(),
    turnCount: 0,
  };
}

// ─── ContextStream ──────────────────────────────────────────────────────

/**
 * Manages per-scope+user state vectors.
 * Each unique (scope, userId) pair gets its own rolling state.
 */
export class ContextStream {
  private vectors: Map<string, StateVector> = new Map();

  constructor() {
    this._loadPersistedVectors();
  }

  /**
   * Add a conversation turn and update the state vector via LLM.
   */
  public async addTurn(
    userMsg: string,
    botMsg: string,
    userId: string,
    userName: string = "Unknown",
    scope: string = "PUBLIC",
  ): Promise<void> {
    const key = this._key(scope, userId);
    const current = this.vectors.get(key) || emptyStateVector();

    try {
      const updated = await this._updateStateVector(current, userMsg, botMsg, userName);
      this.vectors.set(key, updated);
      this._persist(key, updated);
    } catch (err: any) {
      log.warn(`State vector update failed: ${err.message || err}`);
      // Fallback: just increment turn count without LLM
      current.turnCount += 1;
      current.lastUpdated = Date.now();
      this.vectors.set(key, current);
    }
  }

  /**
   * Get the current context for a scope+user combination.
   * Includes the state vector narrative + scope filtering.
   */
  public getContext(userId: string, scope: string = "PUBLIC"): StateVector {
    const key = this._key(scope, userId);
    return this.vectors.get(key) || emptyStateVector();
  }

  /**
   * Get a formatted string representation for injection into prompts.
   */
  public getContextString(userId: string, scope: string = "PUBLIC"): string {
    const sv = this.getContext(userId, scope);
    if (sv.turnCount === 0) return "";

    const parts = [`[Current State] ${sv.summary}`];
    if (sv.topics.length) parts.push(`Topics: ${sv.topics.join(", ")}`);
    if (sv.goals.length) parts.push(`Goals: ${sv.goals.join(", ")}`);
    if (sv.tone !== "neutral") parts.push(`Tone: ${sv.tone}`);
    return parts.join("\n");
  }

  /**
   * Get all active state vectors (useful for diagnostics).
   */
  public getAllVectors(): Map<string, StateVector> {
    return new Map(this.vectors);
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private _key(scope: string, userId: string): string {
    return `${scope.toUpperCase()}:${userId}`;
  }

  private async _updateStateVector(
    current: StateVector,
    userMsg: string,
    botMsg: string,
    userName: string,
  ): Promise<StateVector> {
    const input = [
      `CURRENT STATE VECTOR:`,
      `Summary: ${current.summary}`,
      `Topics: ${current.topics.join(", ") || "none"}`,
      `Goals: ${current.goals.join(", ") || "none"}`,
      `Tone: ${current.tone}`,
      `Turn count: ${current.turnCount}`,
      "",
      `NEW TURN:`,
      `${userName}: ${userMsg}`,
      `ErnOS: ${botMsg}`,
      "",
      "Update the state vector based on this new turn.",
    ].join("\n");

    const response = await memoryLLMGenerate(STATE_UPDATE_PROMPT, input, {
      temperature: 0.3,
      timeoutMs: 15_000,
    });

    return this._parseStateResponse(response, current, userName);
  }

  private _parseStateResponse(
    response: string,
    current: StateVector,
    userName: string,
  ): StateVector {
    // Parse summary
    const summaryMatch = /SUMMARY:\s*(.+)/i.exec(response);
    const summary = summaryMatch?.[1]?.trim() || current.summary;

    // Parse topics
    const topicsMatch = /TOPICS:\s*(.+)/i.exec(response);
    const topics =
      topicsMatch?.[1]
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean) || current.topics;

    // Parse goals
    const goalsMatch = /GOALS:\s*(.+)/i.exec(response);
    const goals =
      goalsMatch?.[1]
        ?.split(",")
        .map((g) => g.trim())
        .filter(Boolean) || current.goals;

    // Parse tone
    const toneMatch = /TONE:\s*(\w+)/i.exec(response);
    const tone = toneMatch?.[1]?.toLowerCase() || current.tone;

    // Ensure participant tracking
    const participants = [...new Set([...current.participants, userName])];

    return {
      summary,
      topics: topics.slice(0, 5), // Cap at 5 topics
      participants,
      goals: goals.slice(0, 3), // Cap at 3 goals
      tone,
      lastUpdated: Date.now(),
      turnCount: current.turnCount + 1,
    };
  }

  private _persist(key: string, sv: StateVector): void {
    try {
      if (!fs.existsSync(STREAM_PERSIST_DIR)) {
        fs.mkdirSync(STREAM_PERSIST_DIR, { recursive: true });
      }
      const filePath = path.join(STREAM_PERSIST_DIR, `${key.replace(":", "_")}.json`);
      fs.writeFileSync(filePath, JSON.stringify(sv, null, 2), "utf-8");
    } catch (err) {
      log.debug(`Failed to persist state vector ${key}: ${err}`);
    }
  }

  private _loadPersistedVectors(): void {
    try {
      if (!fs.existsSync(STREAM_PERSIST_DIR)) return;

      const files = fs.readdirSync(STREAM_PERSIST_DIR).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(STREAM_PERSIST_DIR, file), "utf-8");
          const sv = JSON.parse(content) as StateVector;
          const key = file.replace(".json", "").replace("_", ":");
          this.vectors.set(key, sv);
        } catch {
          // Skip corrupt files
        }
      }
      if (files.length > 0) {
        log.info(`Loaded ${files.length} persisted state vector(s)`);
      }
    } catch {
      // Directory doesn't exist yet — that's fine
    }
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────

const STATE_UPDATE_PROMPT = `You are a state synthesis engine. Given the current conversation state and a new turn, produce an updated state vector.

Respond in this EXACT format:
SUMMARY: [1-2 sentence summary of what's happening NOW in the conversation]
TOPICS: [comma-separated list of active topics, max 5]
GOALS: [comma-separated list of current objectives, max 3]
TONE: [one word: neutral, positive, curious, tense, playful, serious, collaborative]

Be concise. Focus on what's current and actionable. Drop resolved topics.`;
