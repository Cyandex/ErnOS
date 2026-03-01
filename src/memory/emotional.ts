/**
 * EmotionalTracker — PAD Model Emotional State
 *
 * Ported from V3 (Ernos 3.0/src/memory/emotional.py).
 *
 * Implements the Pleasure-Arousal-Dominance model:
 *   - 18 emotion keywords mapped to PAD vectors
 *   - Smooth state transitions with intensity blending
 *   - State persistence + history log
 *   - Periodic decay towards neutral
 *   - Visual bar output for HUD
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { STATE_DIR } from "../config/paths.js";

// ── Paths ──────────────────────────────────────────────────
const STATE_FILE = join(STATE_DIR, "memory", "core", "emotional_state.json");
const HISTORY_FILE = join(STATE_DIR, "memory", "core", "emotional_history.jsonl");

// ── Types ──────────────────────────────────────────────────
interface EmotionalState {
  pleasure: number; // -1.0 (unhappy) to +1.0 (happy)
  arousal: number; // -1.0 (calm) to +1.0 (excited)
  dominance: number; // -1.0 (submissive) to +1.0 (dominant)
  timestamp: number;
  trigger?: string;
}

type PADVector = [number, number, number];

// ── Emotion Map ────────────────────────────────────────────
const EMOTION_MAP: Record<string, PADVector> = {
  // Positive high arousal
  excited: [0.8, 0.8, 0.5],
  joyful: [0.9, 0.5, 0.3],
  playful: [0.7, 0.6, 0.4],
  curious: [0.6, 0.4, 0.3],
  // Positive low arousal
  content: [0.6, -0.3, 0.2],
  peaceful: [0.5, -0.5, 0.0],
  calm: [0.3, -0.6, 0.0],
  relaxed: [0.4, -0.4, 0.1],
  // Negative high arousal
  frustrated: [-0.5, 0.6, -0.2],
  anxious: [-0.4, 0.7, -0.4],
  overwhelmed: [-0.3, 0.8, -0.5],
  confused: [-0.2, 0.5, -0.3],
  // Negative low arousal
  sad: [-0.6, -0.3, -0.2],
  tired: [-0.2, -0.6, -0.1],
  disappointed: [-0.4, -0.2, -0.2],
  bored: [-0.3, -0.5, 0.0],
  // Neutral/Professional
  focused: [0.2, 0.3, 0.4],
  neutral: [0.0, 0.0, 0.0],
  attentive: [0.3, 0.2, 0.2],
  thoughtful: [0.2, -0.1, 0.2],
};

// ── Helpers ────────────────────────────────────────────────
function clamp(v: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function makeBar(value: number, posEmoji: string, negEmoji: string): string {
  const normalized = (value + 1) / 2; // 0 to 1
  const filled = Math.round(normalized * 5);
  return `${negEmoji}${"█".repeat(filled)}${"░".repeat(5 - filled)}${posEmoji}`;
}

// ── Core Class ─────────────────────────────────────────────
export class EmotionalTracker {
  private state: EmotionalState;
  private history: EmotionalState[] = [];

  constructor() {
    this.state = this.loadState();
    this.loadHistory();
  }

  private loadState(): EmotionalState {
    try {
      if (existsSync(STATE_FILE)) {
        const data = JSON.parse(readFileSync(STATE_FILE, "utf8"));
        return {
          pleasure: data.pleasure ?? 0.3,
          arousal: data.arousal ?? 0.2,
          dominance: data.dominance ?? 0.2,
          timestamp: data.timestamp ?? Date.now(),
          trigger: data.trigger,
        };
      }
    } catch {
      // Corrupt — start fresh
    }
    // Default: slightly positive, calm, confident
    return {
      pleasure: 0.3,
      arousal: 0.2,
      dominance: 0.2,
      timestamp: Date.now(),
      trigger: "initialization",
    };
  }

  private saveState(): void {
    try {
      mkdirSync(dirname(STATE_FILE), { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {
      // Non-fatal
    }
  }

  private loadHistory(): void {
    try {
      if (existsSync(HISTORY_FILE)) {
        const lines = readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
        this.history = lines.slice(-50).map((l) => JSON.parse(l) as EmotionalState);
      }
    } catch {
      // Non-fatal
    }
  }

  private saveToHistory(state: EmotionalState): void {
    try {
      mkdirSync(dirname(HISTORY_FILE), { recursive: true });
      appendFileSync(HISTORY_FILE, JSON.stringify(state) + "\n");
      this.history.push(state);
      if (this.history.length > 50) {
        this.history = this.history.slice(-50);
      }
    } catch {
      // Non-fatal
    }
  }

  /** Update state from an emotion keyword. */
  updateFromEmotion(emotion: string, intensity = 0.5): void {
    const key = emotion.toLowerCase();
    const target = EMOTION_MAP[key];
    if (!target) return;

    const decay = 0.3 + 0.4 * intensity;

    const newState: EmotionalState = {
      pleasure: clamp((1 - decay) * this.state.pleasure + decay * target[0]),
      arousal: clamp((1 - decay) * this.state.arousal + decay * target[1]),
      dominance: clamp((1 - decay) * this.state.dominance + decay * target[2]),
      timestamp: Date.now(),
      trigger: key,
    };

    this.saveToHistory(this.state);
    this.state = newState;
    this.saveState();
  }

  /** Update from interaction sentiment. */
  updateFromInteraction(sentiment: "positive" | "negative" | "neutral", intensity = 0.5): void {
    if (sentiment === "positive") this.updateFromEmotion("joyful", intensity);
    else if (sentiment === "negative") this.updateFromEmotion("thoughtful", intensity * 0.5);
    else this.updateFromEmotion("neutral", intensity * 0.3);
  }

  /** Get closest emotion word for current state. */
  getCurrentEmotion(): string {
    const { pleasure: p, arousal: a, dominance: d } = this.state;
    let closest = "neutral";
    let minDist = Infinity;

    for (const [emotion, [ep, ea, ed]] of Object.entries(EMOTION_MAP)) {
      const dist = Math.sqrt((p - ep) ** 2 + (a - ea) ** 2 + (d - ed) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = emotion;
      }
    }
    return closest;
  }

  /** Decay towards neutral. Call periodically. */
  decayState(factor = 0.95): void {
    this.state.pleasure *= factor;
    this.state.arousal *= factor;
    this.state.dominance *= factor;
    this.saveState();
  }

  /** Get formatted emotional state for HUD. */
  getFormattedState(): string {
    const emotion = this.getCurrentEmotion();
    const { pleasure: p, arousal: a, dominance: d } = this.state;

    const pBar = makeBar(p, "😊", "😔");
    const aBar = makeBar(a, "⚡", "😌");
    const dBar = makeBar(d, "💪", "🤝");

    return [
      `**Mood**: ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`,
      `Pleasure: ${pBar} (${p >= 0 ? "+" : ""}${p.toFixed(2)})`,
      `Arousal:  ${aBar} (${a >= 0 ? "+" : ""}${a.toFixed(2)})`,
      `Dominance: ${dBar} (${d >= 0 ? "+" : ""}${d.toFixed(2)})`,
    ].join("\n");
  }

  /** Raw PAD values for programmatic use. */
  getState(): EmotionalState {
    return { ...this.state };
  }
}

// ── Singleton ────────────────────────────────────────────
let _instance: EmotionalTracker | undefined;

export function getEmotionalTracker(): EmotionalTracker {
  if (!_instance) {
    _instance = new EmotionalTracker();
  }
  return _instance;
}

export function _resetEmotionalTracker(): void {
  _instance = undefined;
}

// Export for testing
export { STATE_FILE as _EMOTIONAL_STATE_FILE, HISTORY_FILE as _EMOTIONAL_HISTORY_FILE };
