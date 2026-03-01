import * as fs from "fs";
import * as path from "path";

export interface TaskStep {
  id: string;
  description: string;
  status: "pending" | "active" | "completed" | "skipped";
}

export interface TaskPlan {
  id: string;
  objective: string;
  steps: TaskStep[];
  createdAt: number;
  status: "active" | "completed";
  /** Current step index (0-based). */
  currentStep: number;
  /** User who owns this task. */
  userId?: string;
}

/** How long before a task auto-expires (1 hour, matching V3). */
const EXPIRY_MS = 60 * 60 * 1000;

export class TaskTracker {
  private tasks: Map<string, TaskPlan>;
  private persistPath: string;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "tasks.json")) {
    this.persistPath = persistPath;
    this.tasks = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          this.tasks.set(k, v as TaskPlan);
        }
      }
    } catch (e) {
      console.warn(`[TaskTracker] Load failed: ${String(e)}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}
      fs.writeFileSync(this.persistPath, JSON.stringify(Object.fromEntries(this.tasks), null, 2));
    } catch (e) {
      console.error(`[TaskTracker] Save failed: ${String(e)}`);
    }
  }

  /** Returns true if the task is expired (older than 1 hour). */
  private isExpired(task: TaskPlan): boolean {
    return Date.now() - task.createdAt > EXPIRY_MS;
  }

  /**
   * Create a new task plan, breaking a complex request into numbered steps.
   * The first step is automatically set to "active".
   */
  public planTask(objective: string, steps: string[], userId?: string): TaskPlan {
    const id = `task_${Date.now()}`;
    const plan: TaskPlan = {
      id,
      objective,
      steps: steps.map((s, i) => ({
        id: `step_${i}`,
        description: s,
        status: i === 0 ? "active" : "pending",
      })),
      createdAt: Date.now(),
      status: "active",
      currentStep: 0,
      userId,
    };
    this.tasks.set(id, plan);
    this.saveToDisk();
    return plan;
  }

  /**
   * Mark the current active step as completed and advance to the next pending step.
   * If all steps are done, the task status is set to "completed".
   */
  public completeActiveStep(taskId: string): TaskPlan | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "active") {return task ?? null;}

    if (task.currentStep < task.steps.length) {
      task.steps[task.currentStep].status = "completed";
    }

    // Advance to next pending step
    task.currentStep++;
    if (task.currentStep >= task.steps.length) {
      task.status = "completed";
    } else {
      task.steps[task.currentStep].status = "active";
    }

    this.saveToDisk();
    return task;
  }

  /**
   * Skip the current active step (e.g. not needed) and advance to the next.
   * Ported from V3's skip_step tool.
   */
  public skipStep(taskId: string, _reason?: string): TaskPlan | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "active") {return task ?? null;}

    if (task.currentStep < task.steps.length) {
      task.steps[task.currentStep].status = "skipped";
    }

    task.currentStep++;
    if (task.currentStep >= task.steps.length) {
      task.status = "completed";
    } else {
      task.steps[task.currentStep].status = "active";
    }

    this.saveToDisk();
    return task;
  }

  /** Remove a task from memory and disk. */
  public clearTask(taskId: string): boolean {
    const existed = this.tasks.delete(taskId);
    if (existed) {this.saveToDisk();}
    return existed;
  }

  /** Get the current status of a specific task. Returns null if not found or expired. */
  public getTaskStatus(taskId: string): TaskPlan | null {
    const task = this.tasks.get(taskId) ?? null;
    if (task && this.isExpired(task)) {
      this.tasks.delete(taskId);
      this.saveToDisk();
      return null;
    }
    return task;
  }

  /**
   * Find the active task for a given user. Returns null if none or expired.
   */
  public getActiveTaskForUser(userId: string): TaskPlan | null {
    for (const task of this.tasks.values()) {
      if (task.userId === userId && task.status === "active") {
        if (this.isExpired(task)) {
          this.tasks.delete(task.id);
          this.saveToDisk();
          continue;
        }
        return task;
      }
    }
    return null;
  }

  /**
   * List all non-expired tasks, optionally filtered by userId.
   */
  public listAllTasks(userId?: string): TaskPlan[] {
    const results: TaskPlan[] = [];
    const expired: string[] = [];

    for (const task of this.tasks.values()) {
      if (this.isExpired(task)) {
        expired.push(task.id);
        continue;
      }
      if (!userId || task.userId === userId) {
        results.push(task);
      }
    }

    // Clean up expired tasks
    if (expired.length > 0) {
      for (const id of expired) {this.tasks.delete(id);}
      this.saveToDisk();
    }

    return results;
  }

  /**
   * Generate a formatted context string for LLM system prompt injection.
   * Called by the cognition layer to keep the model focused on the current step.
   *
   * Returns empty string if no active task for the user.
   * Ported from V3's get_active_task_context().
   */
  public getActiveTaskContext(userId: string): string {
    const task = this.getActiveTaskForUser(userId);
    if (!task) {return "";}

    const icons: Record<string, string> = {
      pending: "⬜",
      active: "🔶",
      completed: "✅",
      skipped: "⏭️",
    };

    const lines = [`[ACTIVE TASK: ${task.objective}]`];
    for (const s of task.steps) {
      const icon = icons[s.status] ?? "❓";
      lines.push(`  ${icon} Step ${s.id}: ${s.description} [${s.status.toUpperCase()}]`);
    }
    lines.push(
      `[CURRENT: Step ${task.currentStep} — ` +
        `Focus on this step ONLY. Do NOT repeat completed steps.]`,
    );
    return lines.join("\n");
  }
}

/**
 * Format a task plan into a human-readable status string with emoji icons.
 * Used by tool outputs to show the user current progress.
 */
export function formatTaskStatus(task: TaskPlan): string {
  const icons: Record<string, string> = {
    pending: "⬜",
    active: "🔶",
    completed: "✅",
    skipped: "⏭️",
  };

  const lines = [`Task: ${task.objective} [${task.status.toUpperCase()}]`];
  for (const s of task.steps) {
    const icon = icons[s.status] ?? "❓";
    lines.push(`  ${icon} ${s.id}: ${s.description}`);
  }

  if (task.status === "completed") {
    lines.push("✅ All steps complete!");
  } else if (task.currentStep < task.steps.length) {
    lines.push(
      `▶ Next: Step ${task.currentStep} — ${task.steps[task.currentStep].description}`,
    );
  }

  return lines.join("\n");
}

export const taskTracker = new TaskTracker();
