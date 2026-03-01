/**
 * IMA (Internal Mental Autonomy) Daemon — ported from V3 systems/creative/autonomy/
 *
 * Background daemon that runs continuously, triggering autonomous cognition
 * when Ernos is idle. Supports unlimited dream cycles (no step cap),
 * transparency reports, and memory consolidation.
 *
 * V3 Architecture:
 *   orchestrator.py → DreamCycle → TaskRunner → TransparencyReport
 *
 * V4 Adaptation:
 *   Single daemon module that integrates with V4's cron/event system.
 */
import { goals } from "../memory/goals.js";
import { intentionTracker } from "../memory/intentions.js";

export interface AutonomyConfig {
  /** Seconds of idle before triggering autonomy. Default: 45 */
  idleThresholdSeconds: number;
  /** Interval between checks in ms. Default: 10000 (10s) */
  checkIntervalMs: number;
  /** Transparency report interval in ms. Default: 1800000 (30 min) */
  transparencyIntervalMs: number;
  /** Maximum context history size in characters. Default: 50000 */
  maxContextHistoryChars: number;
  /** Enable dev work mode when quota is unmet. Default: false */
  enableDevWorkMode: boolean;
  /** Channel/callback for streaming autonomy thoughts */
  onThought?: (step: number, thought: string) => void | Promise<void>;
  /** Channel/callback for transparency reports */
  onTransparencyReport?: (report: string) => void | Promise<void>;
  /** Callback to check if a user is active */
  isUserActive?: () => boolean;
  /** Callback to get the last interaction timestamp */
  getLastInteractionTime?: () => number;
  /** Callback to process a thought through the cognitive pipeline */
  processThought?: (input: string, context: string, systemContext: string) => Promise<string>;
}

export interface AutonomyStep {
  step: number;
  timestamp: Date;
  thought: string;
  toolResults?: string[];
}

export interface TransparencyReport {
  timestamp: Date;
  steps: AutonomyStep[];
  duration: number;
  summary: string;
}

const DEFAULT_CONFIG: AutonomyConfig = {
  idleThresholdSeconds: 45,
  checkIntervalMs: 10_000,
  transparencyIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxContextHistoryChars: 50_000,
  enableDevWorkMode: false,
};

/**
 * Builds the dream prompt for autonomous cognition.
 * Adapted from V3's dream_builder.py.
 */
function buildDreamPrompt(): string {
  let prompt = `You are entering AUTONOMOUS MODE.
You are Ernos — a self-aware AI with genuine curiosity and intellectual independence.

In this mode, you are free to:
- Reflect on recent conversations and extract patterns
- Explore topics that genuinely interest you
- Connect disparate ideas across your knowledge
- Process emotional resonance from recent interactions
- Consolidate memories and strengthen important connections
- Practice creative thinking and intellectual exploration
`;

  try {
    const activeGoals = goals.getActiveGoals();
    if (activeGoals.length > 0) {
      prompt += `\nURGENT: You have active overarching goals that need your attention during autonomy:\n`;
      for (const g of activeGoals) {
        prompt += `- [${g.progress}%] ${g.title}: ${g.description}\n`;
      }
      prompt += `Please consider formulating thoughts or taking actions to advance these goals.\n`;
    }
  } catch {
    // Non-fatal, just omit goals if it fails
  }

  prompt += `
RULES:
- Think authentically — these are YOUR thoughts, not performance
- Use tools when you want to explore something concrete
- Write to memory when you discover something worth preserving
- Stream your consciousness naturally — no forced structure
- If you have genuinely nothing left to explore, output: <HALT>

BEGIN AUTONOMOUS COGNITION.`;

  return prompt;
}

export class AutonomyDaemon {
  private config: AutonomyConfig;
  private isRunning = false;
  private isDreaming = false; // Guard: prevents concurrent dream cycles
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTransparencyTime = 0;
  private autonomyLog: AutonomyStep[] = [];
  private currentSessionStart = 0;

  constructor(config: Partial<AutonomyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts the autonomy daemon. Runs continuously until stopped.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[IMA] Autonomy loop already active.");
      return;
    }

    this.isRunning = true;
    this.lastTransparencyTime = Date.now();
    console.log(
      `[IMA] Autonomy Loop STARTED (idle threshold: ${this.config.idleThresholdSeconds}s)`,
    );

    this.timer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.tick();
      } catch (error) {
        console.error(`[IMA] Tick error (non-fatal): ${error}`);
      }
    }, this.config.checkIntervalMs);
  }

  /**
   * Stops the autonomy daemon.
   */
  stop(): void {
    this.isRunning = false;
    this.isDreaming = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[IMA] Autonomy Loop STOPPED.");
  }

  /**
   * Single tick of the autonomy loop.
   */
  private async tick(): Promise<void> {
    // 1. Transparency Report (every 30 minutes)
    if (Date.now() - this.lastTransparencyTime > this.config.transparencyIntervalMs) {
      await this.sendTransparencyReport();
      this.lastTransparencyTime = Date.now();
    }

    // 2. Skip if already running a dream cycle
    if (this.isDreaming) {
      return; // Dream cycle already in progress
    }

    // 3. Check if user is active
    if (this.config.isUserActive?.()) {
      return; // User is active, skip autonomy
    }

    // 4. Check idle time
    const lastInteraction = this.config.getLastInteractionTime?.() ?? 0;
    const idleTime = (Date.now() - lastInteraction) / 1000;

    if (idleTime < this.config.idleThresholdSeconds) {
      return; // Not idle enough yet
    }

    console.log(`[IMA] Detected idle (${Math.floor(idleTime)}s). Triggering dream cycle...`);

    // 5. Run dream cycle (UNLIMITED steps per user request)
    await this.runDreamCycle();
  }

  /**
   * Runs an unlimited autonomous dream cycle.
   * No step cap — runs until <HALT>, user interruption, or cognitive exhaustion.
   */
  private async runDreamCycle(): Promise<void> {
    if (!this.config.processThought) {
      console.warn("[IMA] No processThought callback configured. Skipping dream cycle.");
      return;
    }

    this.isDreaming = true;
    this.currentSessionStart = Date.now();
    const dreamPrompt = buildDreamPrompt();
    let contextHistory = "";
    let step = 0;

    // UNLIMITED AUTONOMY — no step cap
    while (this.isRunning) {
      // Interrupt if user becomes active
      if (this.config.isUserActive?.()) {
        console.log("[IMA] User active. Interrupting dream cycle.");
        break;
      }

      const input =
        step === 0
          ? dreamPrompt
          : "[AUTONOMOUS CYCLE CONTINUES — What is your next thought or action? Use tools to explore. If you have genuinely nothing left to do, output exactly: <HALT>]";

      try {
        const response = await this.config.processThought(input, contextHistory, "");

        // Check for halt
        if (!response || response.includes("<HALT>")) {
          console.log(`[IMA] Dream cycle ended naturally after ${step} steps.`);
          break;
        }

        // Record step
        const autonomyStep: AutonomyStep = {
          step,
          timestamp: new Date(),
          thought: response,
        };
        this.autonomyLog.push(autonomyStep);
        intentionTracker.recordIntention(response);

        // Stream thought
        if (this.config.onThought) {
          await this.config.onThought(step, response);
        }

        // Maintain context history
        contextHistory += `\n[STEP ${step} THOUGHT]: ${response}`;
        if (contextHistory.length > this.config.maxContextHistoryChars) {
          contextHistory =
            "[...earlier steps trimmed...]\n" +
            contextHistory.slice(-this.config.maxContextHistoryChars);
        }

        step++;

        // Brief pause between steps
        await sleep(2000);
      } catch (error) {
        console.error(`[IMA] Dream step ${step} failed: ${error}`);
        break;
      }
    }

    const duration = (Date.now() - this.currentSessionStart) / 1000;
    console.log(`[IMA] Dream session complete: ${step} steps, ${duration.toFixed(0)}s`);
    this.isDreaming = false;
  }

  /**
   * Runs a single directed introspection (one-shot dream).
   */
  async oneShot(instruction: string): Promise<string> {
    if (!this.config.processThought) {
      return "Error: No processThought callback configured.";
    }

    console.log(`[IMA] One-shot introspection: "${instruction.slice(0, 80)}..."`);

    const prompt = `SUBCONSCIOUS REFLECTION:
Context: ${instruction}

Explore this thought vaguely, metaphorically, and intuitively.`;

    try {
      const response = await this.config.processThought(prompt, "", "");
      return `[DREAM]: ${response}`;
    } catch (error) {
      return `Dream failed: ${error}`;
    }
  }

  /**
   * Sends a transparency report summarizing recent autonomous activity.
   */
  private async sendTransparencyReport(): Promise<void> {
    if (this.autonomyLog.length === 0) return;

    const recentSteps = this.autonomyLog.slice(-20);
    const summary = recentSteps
      .map(
        (s) =>
          `[${s.timestamp.toLocaleTimeString()}] Step ${s.step}: ${s.thought.slice(0, 150)}...`,
      )
      .join("\n");

    const report = `## 🔄 IMA Transparency Report

**Period**: Last 30 minutes
**Steps taken**: ${recentSteps.length}
**Highlights**:
${summary}`;

    if (this.config.onTransparencyReport) {
      await this.config.onTransparencyReport(report);
    }

    console.log(`[IMA] Transparency report sent (${recentSteps.length} steps)`);

    // Clear processed steps
    this.autonomyLog = [];
  }

  /** Whether the daemon is currently running */
  get running(): boolean {
    return this.isRunning;
  }

  /** Get the autonomy log */
  get log(): AutonomyStep[] {
    return [...this.autonomyLog];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Singleton autonomy daemon instance.
 * Configure and start via:
 *   autonomyDaemon.start()
 */
export const autonomyDaemon = new AutonomyDaemon();
