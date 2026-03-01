/**
 * Integration tests for the Five-Tier Memory pipeline.
 * Tests MemoryStore observe() → recall() round-trip,
 * TapeMachine operations, and KG graceful degradation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EpistemicTracker } from "../../src/memory/epistemic";
import { KnowledgeGraph } from "../../src/memory/knowledge-graph/graph";
import { LessonManager } from "../../src/memory/lessons";
import { SemanticSalienceEngine } from "../../src/memory/salience";
import { TapeMachine } from "../../src/memory/tape-machine";
import { WorkingMemory } from "../../src/memory/working";

describe("Memory Pipeline Integration", () => {
  describe("WorkingMemory", () => {
    let wm: WorkingMemory;

    beforeEach(() => {
      // Use a temp path to avoid polluting real data
      wm = new WorkingMemory(500, "/tmp/test_working_memory.jsonl");
    });

    it("should add a turn and retrieve context", async () => {
      await wm.addTurn("Hello", "Hi there!", "user1", "TestUser", "PUBLIC");
      const ctx = wm.getContextString("PUBLIC", "user1");
      expect(ctx).toContain("TestUser");
      expect(ctx).toContain("Hello");
      expect(ctx).toContain("Hi there!");
    });

    it("should filter by PRIVATE scope", async () => {
      await wm.addTurn("secret", "confidential", "user1", "Alice", "PRIVATE");
      await wm.addTurn("public msg", "public reply", "user2", "Bob", "PUBLIC");

      const publicCtx = wm.getContextString("PUBLIC");
      expect(publicCtx).toContain("Bob");
      expect(publicCtx).not.toContain("secret");

      const privateCtx = wm.getContextString("PRIVATE", "user1");
      expect(privateCtx).toContain("secret");
    });
  });

  describe("TapeMachine", () => {
    let tape: TapeMachine;

    beforeEach(() => {
      tape = new TapeMachine("test-user", "PUBLIC");
    });

    it("should write and read symbols", () => {
      tape.write("THOUGHT", "Testing the tape");
      const view = tape.getRawView(1);
      expect(view).toBeDefined();
    });

    it("should support seek operations", () => {
      tape.seek(5, 0, 0);
      // Verify by reading — after seeking, the view should reflect the new position
      const view = tape.getRawView(0);
      expect(view).toContain("X=5");
    });
  });

  describe("SemanticSalienceEngine", () => {
    let engine: SemanticSalienceEngine;

    beforeEach(() => {
      engine = new SemanticSalienceEngine();
    });

    it("should score text by salience", () => {
      const score = engine.scoreText("This is a very important discovery about quantum physics");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe("LessonManager", () => {
    let lessons: LessonManager;

    beforeEach(() => {
      lessons = new LessonManager("/tmp/test_lessons.json");
    });

    it("should store and retrieve lessons", () => {
      lessons.addLesson("technology", "TypeScript is awesome");
      const all = lessons.getAllLessons();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all.some((l) => l.fact.includes("TypeScript"))).toBe(true);
    });
  });

  describe("EpistemicTracker", () => {
    let tracker: EpistemicTracker;

    beforeEach(() => {
      tracker = new EpistemicTracker();
    });

    it("should track fact reliability", () => {
      tracker.recordFact("sky-color", "observation", 0.95);
      const fact = tracker.getFactReliability("sky-color");
      expect(fact).toBeDefined();
      expect(fact!.confidence).toBeGreaterThan(0);
    });
  });

  describe("KnowledgeGraph (graceful degradation)", () => {
    let kg: KnowledgeGraph;

    beforeEach(() => {
      kg = new KnowledgeGraph();
    });

    it("should not crash when Neo4j is unavailable", async () => {
      // The KG should degrade gracefully when Neo4j connection fails
      const context = await kg.queryContext("TestUser", null, null, "PUBLIC");
      expect(context).toBeDefined();
    });

    it("should have a quarantine queue", () => {
      const queue = kg.quarantine.getPendingFacts();
      expect(Array.isArray(queue)).toBe(true);
    });

    it("should support decay operations without crashing", async () => {
      const count = await kg.decayConnections();
      expect(typeof count).toBe("number");
    });
  });
});
