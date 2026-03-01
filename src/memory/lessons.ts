import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";

export interface Lesson {
  id: string;
  topic: string;
  fact: string;
  learnedAt: number;
}

export class LessonManager {
  private persistPath: string;
  private lessons: Map<string, Lesson>;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "core", "lessons.json")) {
    this.persistPath = persistPath;
    this.lessons = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        for (const [key, val] of Object.entries(parsed)) {
          this.lessons.set(key, val as Lesson);
        }
      }
    } catch (e) {
      console.warn(`Failed to load lessons from disk: ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.lessons);
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Failed to persist lessons: ${e}`);
    }
  }

  public addLesson(topic: string, fact: string): Lesson {
    const id = `lesson_${randomUUID()}`;
    const lesson: Lesson = {
      id,
      topic,
      fact,
      learnedAt: Date.now(),
    };
    this.lessons.set(id, lesson);
    this.saveToDisk();
    return lesson;
  }

  public getLessonsByTopic(topic: string): Lesson[] {
    const targetTopic = topic.toLowerCase();
    return Array.from(this.lessons.values()).filter((l) => l.topic.toLowerCase() === targetTopic);
  }

  public getAllLessons(): Lesson[] {
    return Array.from(this.lessons.values());
  }

  public removeLesson(id: string): boolean {
    const deleted = this.lessons.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }
}
