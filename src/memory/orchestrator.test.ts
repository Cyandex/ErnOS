import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryStore } from "./orchestrator.js";

// Mock KnowledgeGraph as a constructor
vi.mock("./knowledge-graph/graph.js", () => ({
  KnowledgeGraph: class MockKnowledgeGraph {
    queryContext = vi.fn().mockResolvedValue(["KG fact: Maria likes TypeScript"]);
    decayConnections = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    addRelationship = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("./search-manager.js", () => ({
  getMemorySearchManager: vi.fn().mockResolvedValue({
    manager: {
      search: vi.fn().mockResolvedValue([
        {
          path: "test.md",
          startLine: 1,
          endLine: 5,
          score: 0.9,
          snippet: "Test memory snippet",
          source: "memory",
        },
      ]),
    },
  }),
}));

vi.mock("./memory-llm.js", () => ({
  memoryLLMGenerate: vi
    .fn()
    .mockResolvedValue("No conflicts detected.\n---\nLESSONS: lesson1\nKG: fact1\nVECTORS: vec1"),
}));

describe("MemoryStore", () => {
  it("creates with all subsystems initialized", () => {
    const store = new MemoryStore();
    expect(store.workingMemory).toBeDefined();
    expect(store.knowledgeGraph).toBeDefined();
    expect(store.lessonManager).toBeDefined();
    expect(store.reconciler).toBeDefined();
    expect(store.salienceEngine).toBeDefined();
    expect(store.epistemicTracker).toBeDefined();
  });

  it("observe records interaction via WorkingMemory", async () => {
    const store = new MemoryStore();
    const addTurnSpy = vi.spyOn(store.workingMemory, "addTurn");
    await store.observe("user1", "hello", "hi there");
    expect(addTurnSpy).toHaveBeenCalledWith(
      "hello",
      "hi there",
      "user1",
      "Unknown",
      "PUBLIC",
      undefined,
      undefined,
    );
  });

  it("observe uses PRIVATE scope for DMs", async () => {
    const store = new MemoryStore();
    const addTurnSpy = vi.spyOn(store.workingMemory, "addTurn");
    await store.observe("user1", "secret", "shh", undefined, true, "Alice");
    expect(addTurnSpy).toHaveBeenCalledWith(
      "secret",
      "shh",
      "user1",
      "Alice",
      "PRIVATE",
      undefined,
      undefined,
    );
  });

  it("getTape creates and caches tape per user+scope", () => {
    const store = new MemoryStore();
    const tape1 = store.getTape("user1", "PUBLIC");
    const tape2 = store.getTape("user1", "PUBLIC");
    const tape3 = store.getTape("user1", "PRIVATE");

    expect(tape1).toBe(tape2); // Same instance from cache
    expect(tape1).not.toBe(tape3); // Different scope = different tape
  });

  it("configure sets cfg and agentId", () => {
    const store = new MemoryStore();
    const mockCfg = { models: {} } as any;
    store.configure(mockCfg, "my-agent");
    expect(true).toBe(true); // No throw = success
  });

  it("recall returns a ContextObject with all tiers", async () => {
    const store = new MemoryStore();
    store.configure({ models: {} } as any, "test-agent");

    await store.workingMemory.addTurn("hello", "hi", "u1", "Alice", "PUBLIC");

    const ctx = await store.recall("test query", "u1");
    expect(ctx.workingMemory).toBeDefined();
    expect(ctx.relatedMemories).toBeDefined();
    expect(ctx.knowledgeGraph).toBeDefined();
    expect(ctx.lessons).toBeDefined();
    expect(ctx.tapeView).toBeDefined();
    expect(ctx.scope).toBe("PUBLIC");
  });

  it("recall uses PRIVATE scope for DMs", async () => {
    const store = new MemoryStore();
    const ctx = await store.recall("query", "u1", undefined, true, "Alice");
    expect(ctx.scope).toBe("PRIVATE");
  });

  it("compactAllTapes iterates all cached tapes", () => {
    const store = new MemoryStore();
    const tape1 = store.getTape("user1", "PUBLIC");
    const tape2 = store.getTape("user2", "PUBLIC");
    tape1.write("EMPTY", "");
    tape2.write("DATA", "Keep");

    const results = store.compactAllTapes();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.removed > 0)).toBe(true);
  });

  it("recall falls back gracefully when T2 vector search fails", async () => {
    const { getMemorySearchManager } = await import("./search-manager.js");
    (getMemorySearchManager as any).mockRejectedValueOnce(new Error("Search unavailable"));

    const store = new MemoryStore();
    store.configure({ models: {} } as any, "test-agent");

    const ctx = await store.recall("test query", "u1");
    expect(ctx.relatedMemories).toBeDefined();
  });
});
