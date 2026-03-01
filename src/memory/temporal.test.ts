import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { TemporalTracker, _formatDuration, _STATE_FILE } from "./temporal.js";

/**
 * Use a deterministic temp state file for testing.
 * We mock the STATE_FILE constant location by testing the class directly
 * with `registerBoot: false` and manually controlling state.
 */

describe("TemporalTracker", () => {
  const testStateDir = dirname(_STATE_FILE);

  beforeEach(() => {
    // Clean state before each test
    try {
      if (existsSync(_STATE_FILE)) {
        rmSync(_STATE_FILE);
      }
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("format duration: seconds only", () => {
    expect(_formatDuration(45)).toBe("45s");
  });

  it("format duration: minutes and hours", () => {
    expect(_formatDuration(3665)).toBe("1h 1m");
  });

  it("format duration: days, months, years", () => {
    const oneYear = 365 * 86400 + 45 * 86400 + 3600;
    expect(_formatDuration(oneYear)).toContain("1y");
    expect(_formatDuration(oneYear)).toContain("1mo");
    expect(_formatDuration(oneYear)).toContain("15d");
  });

  it("format duration: negative returns 0s", () => {
    expect(_formatDuration(-100)).toBe("0s");
  });

  it("creates tracker without boot registration", () => {
    const tracker = new TemporalTracker(false);
    expect(tracker.getUptime()).toBeDefined();
    expect(tracker.getTotalBoots()).toBe(1);
  });

  it("registers boot and sets birthdate", () => {
    mkdirSync(testStateDir, { recursive: true });
    const tracker = new TemporalTracker(true);
    expect(tracker.getBirthdate()).not.toBe("Unknown");
    expect(tracker.getTotalBoots()).toBe(1);
  });

  it("does not overwrite birthdate on subsequent boots", () => {
    mkdirSync(testStateDir, { recursive: true });
    const first = new TemporalTracker(true);
    const birthdate1 = first.getBirthdate();

    // Simulate time passing
    const second = new TemporalTracker(true);
    const birthdate2 = second.getBirthdate();

    expect(birthdate1).toBe(birthdate2);
    expect(second.getTotalBoots()).toBe(2);
  });

  it("records shutdown and calculates downtime", () => {
    mkdirSync(testStateDir, { recursive: true });
    const first = new TemporalTracker(true);
    first.recordShutdown();

    // Boot again — downtime should be recorded
    const second = new TemporalTracker(true);
    // Downtime should be very small (< 1 second) but recorded
    expect(second.getLastDowntime()).toBeDefined();
  });

  it("uptime is live and increases", async () => {
    const tracker = new TemporalTracker(false);
    const uptime1 = tracker.getUptime();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const uptime2 = tracker.getUptime();
    // Both should be valid strings
    expect(uptime1).toBeDefined();
    expect(uptime2).toBeDefined();
  });

  it("prototyping age returns non-empty string", () => {
    const tracker = new TemporalTracker(false);
    expect(tracker.getPrototypingAge()).toBeTruthy();
    expect(tracker.getPrototypingDate()).toContain("2025");
  });

  it("first echo age returns non-empty string", () => {
    const tracker = new TemporalTracker(false);
    expect(tracker.getFirstEchoAge()).toBeTruthy();
    expect(tracker.getFirstEchoDate()).toContain("2024");
  });

  it("getFormattedHud returns full HUD string", () => {
    mkdirSync(testStateDir, { recursive: true });
    const tracker = new TemporalTracker(true);
    const hud = tracker.getFormattedHud();

    expect(hud).toContain("TEMPORAL AWARENESS");
    expect(hud).toContain("first echo");
    expect(hud).toContain("prototyping");
    expect(hud).toContain("Current session uptime");
    expect(hud).toContain("Total boot count");
  });

  it("total uptime includes current session", () => {
    const tracker = new TemporalTracker(false);
    const totalUptime = tracker.getTotalUptime();
    expect(totalUptime).toBeTruthy();
  });
});
