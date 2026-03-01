import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { LessonManager } from "./lessons.js";

describe("LessonManager", () => {
  let tmpDir: string;
  let persistPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-test-"));
    persistPath = path.join(tmpDir, "lessons.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts with no lessons", () => {
    const mgr = new LessonManager(persistPath);
    expect(mgr.getAllLessons()).toHaveLength(0);
  });

  it("addLesson stores a lesson with UUID", () => {
    const mgr = new LessonManager(persistPath);
    const lesson = mgr.addLesson("cooking", "Maria prefers spicy food");
    expect(lesson.id).toMatch(/^lesson_/);
    expect(lesson.topic).toBe("cooking");
    expect(lesson.fact).toBe("Maria prefers spicy food");
    expect(lesson.learnedAt).toBeGreaterThan(0);
  });

  it("getAllLessons returns all stored lessons", () => {
    const mgr = new LessonManager(persistPath);
    mgr.addLesson("cooking", "Fact 1");
    mgr.addLesson("music", "Fact 2");
    mgr.addLesson("coding", "Fact 3");
    expect(mgr.getAllLessons()).toHaveLength(3);
  });

  it("getLessonsByTopic filters case-insensitively", () => {
    const mgr = new LessonManager(persistPath);
    mgr.addLesson("Cooking", "Fact 1");
    mgr.addLesson("cooking", "Fact 2");
    mgr.addLesson("Music", "Fact 3");

    const cooking = mgr.getLessonsByTopic("COOKING");
    expect(cooking).toHaveLength(2);
    expect(cooking.every((l) => l.topic.toLowerCase() === "cooking")).toBe(true);
  });

  it("removeLesson deletes by id", () => {
    const mgr = new LessonManager(persistPath);
    const l1 = mgr.addLesson("test", "Fact 1");
    const l2 = mgr.addLesson("test", "Fact 2");

    expect(mgr.removeLesson(l1.id)).toBe(true);
    expect(mgr.getAllLessons()).toHaveLength(1);
    expect(mgr.getAllLessons()[0].id).toBe(l2.id);
  });

  it("removeLesson returns false for non-existent id", () => {
    const mgr = new LessonManager(persistPath);
    expect(mgr.removeLesson("nonexistent")).toBe(false);
  });

  it("persists to disk and reloads", () => {
    const mgr1 = new LessonManager(persistPath);
    mgr1.addLesson("cooking", "Spicy food");
    mgr1.addLesson("coding", "TypeScript");

    const mgr2 = new LessonManager(persistPath);
    expect(mgr2.getAllLessons()).toHaveLength(2);
    expect(mgr2.getAllLessons().map((l) => l.fact)).toContain("Spicy food");
    expect(mgr2.getAllLessons().map((l) => l.fact)).toContain("TypeScript");
  });

  it("handles corrupted persistence file gracefully", () => {
    fs.writeFileSync(persistPath, "{invalid json!!!", "utf-8");
    const mgr = new LessonManager(persistPath);
    expect(mgr.getAllLessons()).toHaveLength(0); // Should start empty, not crash
  });
});
