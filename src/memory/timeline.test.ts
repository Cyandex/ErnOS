import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Timeline } from "./timeline.js";

describe("Timeline", () => {
  let tmpDir: string;
  let logPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-test-"));
    logPath = path.join(tmpDir, "timeline.jsonl");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("addEvent writes to global timeline", () => {
    const tl = new Timeline(logPath);
    tl.addEvent("CHAT", "User said hello", "PUBLIC", "user1", "Alice");
    const events = tl.getRecentEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("CHAT");
    expect(events[0].description).toBe("User said hello");
  });

  it("PRIVATE events are excluded from global timeline", () => {
    const tl = new Timeline(logPath);
    tl.addEvent("CHAT", "Public event", "PUBLIC", "user1");
    tl.addEvent("DM", "Private event", "PRIVATE", "user1");

    const events = tl.getRecentEvents(10, "PUBLIC");
    expect(events).toHaveLength(1);
    expect(events[0].description).toBe("Public event");
  });

  it("getRecentEvents respects limit", () => {
    const tl = new Timeline(logPath);
    for (let i = 0; i < 10; i++) {
      tl.addEvent("CHAT", `Event ${i}`, "PUBLIC");
    }
    const events = tl.getRecentEvents(3);
    expect(events).toHaveLength(3);
  });

  it("getRecentEvents returns most recent first", () => {
    const tl = new Timeline(logPath);
    tl.addEvent("CHAT", "First", "PUBLIC");
    tl.addEvent("CHAT", "Second", "PUBLIC");
    tl.addEvent("CHAT", "Third", "PUBLIC");
    const events = tl.getRecentEvents(2);
    expect(events[0].description).toBe("Third");
    expect(events[1].description).toBe("Second");
  });

  it("records importance and metadata", () => {
    const tl = new Timeline(logPath);
    tl.addEvent("INSIGHT", "Important discovery", "PUBLIC", "user1", "Alice", 0.9, { topic: "AI" });
    const events = tl.getRecentEvents();
    expect(events[0].importance).toBe(0.9);
    expect(events[0].metadata.topic).toBe("AI");
  });

  it("returns empty array when no file exists", () => {
    const tl = new Timeline(path.join(tmpDir, "nonexistent.jsonl"));
    const events = tl.getRecentEvents();
    expect(events).toHaveLength(0);
  });
});
