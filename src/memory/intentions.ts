import * as fs from "fs";
import * as path from "path";
import { STATE_DIR } from "../config/paths.js";

export interface IntentionLog {
  timestamp: number;
  thought: string;
}

export class IntentionTracker {
  private persistPath: string;

  constructor() {
    this.persistPath = path.join(STATE_DIR, "memory", "core", "intentions.jsonl");
  }

  public recordIntention(thought: string): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const entry: IntentionLog = {
        timestamp: Date.now(),
        thought,
      };
      fs.appendFileSync(this.persistPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch (e) {
      console.error(`[IntentionTracker] Save failed: ${e}`);
    }
  }

  public getRecentIntentions(limit = 20): IntentionLog[] {
    try {
      if (!fs.existsSync(this.persistPath)) return [];
      const lines = fs.readFileSync(this.persistPath, "utf-8").split("\n").filter(Boolean);
      return lines.slice(-limit).map((l) => JSON.parse(l) as IntentionLog);
    } catch (e) {
      console.warn(`[IntentionTracker] Load failed: ${e}`);
      return [];
    }
  }
}

export const intentionTracker = new IntentionTracker();
