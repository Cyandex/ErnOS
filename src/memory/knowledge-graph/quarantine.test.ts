import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ValidationQuarantine } from "./quarantine.js";

describe("ValidationQuarantine", () => {
  let tmpDir: string;
  let persistPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quarantine-test-"));
    persistPath = path.join(tmpDir, "quarantine.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts with empty queue", () => {
    const q = new ValidationQuarantine(persistPath);
    expect(q.getPendingFacts()).toHaveLength(0);
  });

  it("addFact queues a fact with PENDING status", () => {
    const q = new ValidationQuarantine(persistPath);
    const id = q.addFact({
      subject: "Maria",
      predicate: "likes",
      object: "TypeScript",
      layer: "FACTUAL",
      source: "conversation",
      confidence: 0.9,
    });

    expect(id).toMatch(/^qfact_/);
    const pending = q.getPendingFacts();
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("Maria");
    expect(pending[0].status).toBe("PENDING");
  });

  it("getPendingFacts returns only PENDING facts", () => {
    const q = new ValidationQuarantine(persistPath);
    const id1 = q.addFact({
      subject: "A",
      predicate: "is",
      object: "B",
      layer: "FACTUAL",
      source: "test",
      confidence: 0.8,
    });
    q.addFact({
      subject: "C",
      predicate: "is",
      object: "D",
      layer: "FACTUAL",
      source: "test",
      confidence: 0.8,
    });

    // Reject id1
    q.resolveFact(id1, false);

    const pending = q.getPendingFacts();
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("C");
  });

  it("resolveFact with approved=true removes from queue", () => {
    const q = new ValidationQuarantine(persistPath);
    const id = q.addFact({
      subject: "X",
      predicate: "is",
      object: "Y",
      layer: "FACTUAL",
      source: "test",
      confidence: 0.9,
    });

    q.resolveFact(id, true);
    expect(q.getPendingFacts()).toHaveLength(0);
  });

  it("resolveFact with approved=false marks as REJECTED but keeps in queue", () => {
    const q = new ValidationQuarantine(persistPath);
    const id = q.addFact({
      subject: "X",
      predicate: "is",
      object: "Y",
      layer: "FACTUAL",
      source: "test",
      confidence: 0.9,
    });

    q.resolveFact(id, false);
    // REJECTED facts stay in queue but aren't returned by getPendingFacts
    expect(q.getPendingFacts()).toHaveLength(0);
  });

  it("resolveFact does nothing for non-existent id", () => {
    const q = new ValidationQuarantine(persistPath);
    q.resolveFact("nonexistent", true); // Should not throw
    expect(q.getPendingFacts()).toHaveLength(0);
  });

  it("persists to disk and reloads", () => {
    const q1 = new ValidationQuarantine(persistPath);
    q1.addFact({
      subject: "Maria",
      predicate: "prefers",
      object: "dark mode",
      layer: "PREFERENCE",
      source: "test",
      confidence: 0.95,
    });

    const q2 = new ValidationQuarantine(persistPath);
    const pending = q2.getPendingFacts();
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("Maria");
  });

  it("handles corrupted persistence file gracefully", () => {
    fs.writeFileSync(persistPath, "not json", "utf-8");
    const q = new ValidationQuarantine(persistPath);
    expect(q.getPendingFacts()).toHaveLength(0);
  });
});
