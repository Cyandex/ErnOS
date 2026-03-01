import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { CalendarSystem } from "./calendar.js";

describe("CalendarSystem", () => {
  let tmpDir: string;
  let persistPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cal-test-"));
    persistPath = path.join(tmpDir, "calendar.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates an event", () => {
    const cal = new CalendarSystem(persistPath);
    const event = cal.createEvent({
      title: "Team Meeting",
      description: "Weekly sync",
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T11:00:00Z",
      ownerId: "user1",
      scope: "PUBLIC",
    });
    expect(event.id).toMatch(/^evt_/);
    expect(event.title).toBe("Team Meeting");
  });

  it("listEvents returns events for user", () => {
    const cal = new CalendarSystem(persistPath);
    cal.createEvent({
      title: "Public Event",
      description: "",
      ownerId: "user1",
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T11:00:00Z",
      scope: "PUBLIC",
    });
    cal.createEvent({
      title: "Private Event",
      description: "",
      ownerId: "user2",
      startTime: "2026-03-02T10:00:00Z",
      endTime: "2026-03-02T11:00:00Z",
      scope: "PRIVATE",
    });

    const user1Events = cal.listEvents("user1", "PUBLIC");
    expect(user1Events.some((e) => e.title === "Public Event")).toBe(true);
    // user2's PRIVATE event should not appear for user1
    expect(user1Events.some((e) => e.title === "Private Event")).toBe(false);
  });

  it("expands daily recurring events", () => {
    const cal = new CalendarSystem(persistPath);
    cal.createEvent({
      title: "Daily Standup",
      description: "Quick sync",
      startTime: "2026-03-01T09:00:00Z",
      endTime: "2026-03-01T09:15:00Z",
      ownerId: "user1",
      scope: "PUBLIC",
      recurrence: { frequency: "daily", count: 5 },
    });

    const events = cal.listEvents("user1");
    expect(events.filter((e) => e.title === "Daily Standup").length).toBe(5);
  });

  it("updateEvent modifies fields", () => {
    const cal = new CalendarSystem(persistPath);
    const event = cal.createEvent({
      title: "Original",
      description: "desc",
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T11:00:00Z",
      ownerId: "user1",
      scope: "PUBLIC",
    });
    const updated = cal.updateEvent(event.id, { title: "Updated" });
    expect(updated!.title).toBe("Updated");
  });

  it("updateEvent returns null for non-existent id", () => {
    const cal = new CalendarSystem(persistPath);
    expect(cal.updateEvent("nope", { title: "X" })).toBeNull();
  });

  it("deleteEvent removes an event", () => {
    const cal = new CalendarSystem(persistPath);
    const event = cal.createEvent({
      title: "Delete Me",
      description: "",
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T11:00:00Z",
      ownerId: "user1",
      scope: "PUBLIC",
    });
    expect(cal.deleteEvent(event.id)).toBe(true);
    expect(cal.listEvents("user1")).toHaveLength(0);
  });

  it("persists and reloads", () => {
    const cal1 = new CalendarSystem(persistPath);
    cal1.createEvent({
      title: "Persistent",
      description: "",
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T11:00:00Z",
      ownerId: "user1",
      scope: "PUBLIC",
    });
    const cal2 = new CalendarSystem(persistPath);
    const events = cal2.listEvents("user1");
    expect(events.some((e) => e.title === "Persistent")).toBe(true);
  });
});
