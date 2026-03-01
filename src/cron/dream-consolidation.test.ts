import { describe, expect, it, vi } from "vitest";
import { DreamConsolidationDaemon } from "./dream-consolidation.js";

vi.mock("../memory/orchestrator.js", () => ({
  systemMemory: {
    reconciler: {
      reconcile: vi.fn().mockResolvedValue({
        conflicts: [],
        stats: { lessons: 0, kg: 0, vector: 0, conflicts: 0 },
      }),
    },
    lessonManager: {
      getAllLessons: vi.fn().mockReturnValue([]),
    },
    knowledgeGraph: {
      queryContext: vi.fn().mockResolvedValue([]),
      decayConnections: vi.fn(),
    },
    salienceEngine: {
      scoreText: vi.fn().mockReturnValue(5),
    },
    workingMemory: {
      consolidate: vi.fn().mockResolvedValue(undefined),
    },
    compactAllTapes: vi.fn().mockReturnValue([{ key: "test", removed: 0 }]),
  },
}));

describe("DreamConsolidationDaemon", () => {
  it("executeNightlyDream runs without error", async () => {
    const daemon = new DreamConsolidationDaemon();
    await expect(daemon.executeNightlyDream("test-user")).resolves.not.toThrow();
  });

  it("is instantiable with correct method", () => {
    const daemon = new DreamConsolidationDaemon();
    expect(daemon).toBeDefined();
    expect(typeof daemon.executeNightlyDream).toBe("function");
  });
});
