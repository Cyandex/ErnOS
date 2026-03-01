import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TapeMachine } from "./tape-machine.js";

describe("TapeMachine", () => {
  // Use unique IDs per test to avoid persistence conflicts
  let testId: string;

  beforeEach(() => {
    testId = `tape_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    // Clean up persisted tape file
    const tapePath = path.join(process.cwd(), "memory", "tape", `${testId}_PUBLIC.json`);
    try {
      fs.unlinkSync(tapePath);
    } catch {}
  });

  it("starts with head at origin", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    const view = tape.getRawView(0);
    expect(view).toContain("X=0 Y=0 Z=0");
  });

  it("write creates a symbol at current position", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("DATA", "Maria likes coding");
    const symbol = tape.read();
    expect(symbol).not.toBeNull();
    expect(symbol!.type).toBe("DATA");
    expect(symbol!.content).toBe("Maria likes coding");
    expect(symbol!.id).toMatch(/^sym_/);
  });

  it("read returns null for empty position", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.seek(99, 99, 99);
    const symbol = tape.read();
    expect(symbol).toBeNull();
  });

  it("seek moves head to specified coordinates", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.seek(5, 3, 1);
    const view = tape.getRawView(0);
    expect(view).toContain("X=5 Y=3 Z=1");
  });

  it("write at different positions creates separate cells", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("DATA", "At origin");
    tape.seek(1, 0, 0);
    tape.write("MEMORY", "At (1,0,0)");

    // Read back origin
    tape.seek(0, 0, 0);
    const s1 = tape.read();
    expect(s1!.content).toBe("At origin");

    // Read back (1,0,0)
    tape.seek(1, 0, 0);
    const s2 = tape.read();
    expect(s2!.content).toBe("At (1,0,0)");
  });

  it("compact removes EMPTY cells", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("EMPTY", "");
    tape.seek(1, 0, 0);
    tape.write("DATA", "Keep this");
    tape.seek(2, 0, 0);
    tape.write("EMPTY", "");

    const removed = tape.compact();
    expect(removed).toBe(2);
    expect(tape.getCellCount()).toBe(1);
  });

  it("compact returns 0 when no EMPTY cells", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("DATA", "Keep");
    tape.seek(1, 0, 0);
    tape.write("MEMORY", "Also keep");

    const removed = tape.compact();
    expect(removed).toBe(0);
    expect(tape.getCellCount()).toBe(2);
  });

  it("getCellCount returns tape size", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    expect(tape.getCellCount()).toBe(0);
    tape.write("DATA", "First");
    expect(tape.getCellCount()).toBe(1);
    tape.seek(1, 0, 0);
    tape.write("DATA", "Second");
    expect(tape.getCellCount()).toBe(2);
  });

  it("getRawView renders surrounding cells", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("DATA", "Origin fact");
    const view = tape.getRawView(2);
    expect(view).toContain("[DATA]");
    expect(view).toContain("Origin fact");
    expect(view).toContain("[EMPTY]");
    expect(view).toContain(">>"); // Head marker
  });

  it("overwriting a cell replaces the symbol", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    tape.write("DATA", "Original");
    tape.write("MEMORY", "Replaced");
    const symbol = tape.read();
    expect(symbol!.content).toBe("Replaced");
    expect(symbol!.type).toBe("MEMORY");
  });

  it("write returns the symbol id", () => {
    const tape = new TapeMachine(testId, "PUBLIC");
    const id = tape.write("GOAL", "Learn TypeScript");
    expect(id).toMatch(/^sym_/);
  });
});
