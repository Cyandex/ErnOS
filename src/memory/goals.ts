import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "abandoned";
  progress: number; // 0-100
  parentGoalId?: string;
  createdAt: number;
  updatedAt: number;
}

export class GoalSystem {
  private goals: Map<string, Goal>;
  private persistPath: string;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "goals.json")) {
    this.persistPath = persistPath;
    this.goals = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          this.goals.set(k, v as Goal);
        }
      }
    } catch (e) {
      console.warn(`[Goals] Load failed: ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(Object.fromEntries(this.goals), null, 2));
    } catch (e) {
      console.error(`[Goals] Save failed: ${e}`);
    }
  }

  public createGoal(title: string, description: string, parentGoalId?: string): Goal {
    const id = `goal_${randomUUID()}`;
    const goal: Goal = {
      id,
      title,
      description,
      status: "active",
      progress: 0,
      parentGoalId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.goals.set(id, goal);
    this.saveToDisk();
    return goal;
  }

  public getActiveGoals(): Goal[] {
    return Array.from(this.goals.values()).filter((g) => g.status === "active");
  }

  public updateProgress(id: string, progress: number, status?: Goal["status"]): Goal | null {
    const goal = this.goals.get(id);
    if (!goal) return null;
    goal.progress = Math.max(0, Math.min(100, progress));
    if (status) goal.status = status;
    if (goal.progress === 100) goal.status = "completed";
    goal.updatedAt = Date.now();
    this.saveToDisk();
    return goal;
  }
}

export const goals = new GoalSystem();
