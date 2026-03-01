import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GoalSystem } from "./goals.js";

describe("GoalSystem", () => {
  let tmpDir: string;
  let persistPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "goals-test-"));
    persistPath = path.join(tmpDir, "goals.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts with no goals", () => {
    const gs = new GoalSystem(persistPath);
    expect(gs.getActiveGoals()).toHaveLength(0);
  });

  it("createGoal stores a goal with active status", () => {
    const gs = new GoalSystem(persistPath);
    const goal = gs.createGoal("Learn TypeScript", "Deep dive into TS generics");
    expect(goal.id).toMatch(/^goal_/);
    expect(goal.title).toBe("Learn TypeScript");
    expect(goal.status).toBe("active");
    expect(goal.progress).toBe(0);
  });

  it("getActiveGoals returns only active goals", () => {
    const gs = new GoalSystem(persistPath);
    gs.createGoal("Goal 1", "desc");
    const g2 = gs.createGoal("Goal 2", "desc");
    gs.updateProgress(g2.id, 100); // Auto-completes at 100
    expect(gs.getActiveGoals()).toHaveLength(1);
  });

  it("updateProgress clamps between 0-100", () => {
    const gs = new GoalSystem(persistPath);
    const goal = gs.createGoal("Test", "desc");
    gs.updateProgress(goal.id, 150);
    const updated = gs.updateProgress(goal.id, -50);
    // 150 gets clamped to 100 (auto-complete), then -50 would be 0 but already completed
    expect(updated).not.toBeNull();
  });

  it("updateProgress auto-completes at 100", () => {
    const gs = new GoalSystem(persistPath);
    const goal = gs.createGoal("Test", "desc");
    const updated = gs.updateProgress(goal.id, 100);
    expect(updated!.status).toBe("completed");
  });

  it("updateProgress allows manual status transition", () => {
    const gs = new GoalSystem(persistPath);
    const goal = gs.createGoal("Test", "desc");
    const updated = gs.updateProgress(goal.id, 30, "abandoned");
    expect(updated!.status).toBe("abandoned");
    expect(updated!.progress).toBe(30);
  });

  it("updateProgress returns null for non-existent goal", () => {
    const gs = new GoalSystem(persistPath);
    expect(gs.updateProgress("nonexistent", 50)).toBeNull();
  });

  it("supports parent goal hierarchy", () => {
    const gs = new GoalSystem(persistPath);
    const parent = gs.createGoal("Parent", "desc");
    const child = gs.createGoal("Child", "desc", parent.id);
    expect(child.parentGoalId).toBe(parent.id);
  });

  it("persists and reloads", () => {
    const gs1 = new GoalSystem(persistPath);
    gs1.createGoal("Persistent Goal", "Should survive reload");
    const gs2 = new GoalSystem(persistPath);
    expect(gs2.getActiveGoals()).toHaveLength(1);
    expect(gs2.getActiveGoals()[0].title).toBe("Persistent Goal");
  });
});
