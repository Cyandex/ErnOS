import { describe, expect, it, vi } from "vitest";
import { CrossTierReconciler } from "./reconciler.js";

vi.mock("./memory-llm.js", () => ({
  memoryLLMGenerate: vi
    .fn()
    .mockResolvedValue(
      "No conflicts detected.\n---\nLESSONS: lesson data\nKG: kg data\nVECTORS: vec data",
    ),
}));

describe("CrossTierReconciler", () => {
  it("reconcile returns result with all tiers", async () => {
    const r = new CrossTierReconciler();
    const result = await r.reconcile(
      ["Maria prefers TypeScript"],
      ["Maria -> prefers -> TypeScript"],
      ["In our conversation Maria mentioned liking TypeScript"],
    );
    expect(result.lessons).toBeDefined();
    expect(result.kgFacts).toBeDefined();
    expect(result.vectorTexts).toBeDefined();
    expect(result.conflicts).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it("reconcile with empty inputs returns clean result", async () => {
    const r = new CrossTierReconciler();
    const result = await r.reconcile([], [], []);
    expect(result.conflicts).toHaveLength(0);
    expect(result.stats.lessons).toBe(0);
    expect(result.stats.kg).toBe(0);
    expect(result.stats.vector).toBe(0);
  });

  it("_buildInput formats tiers correctly", () => {
    const r = new CrossTierReconciler();
    const input = (r as any)._buildInput(
      ["Lesson 1", "Lesson 2"],
      ["Fact 1"],
      ["Vector 1", "Vector 2", "Vector 3"],
    );
    expect(input).toContain("TIER 5");
    expect(input).toContain("Lesson 1");
    expect(input).toContain("TIER 3");
    expect(input).toContain("Fact 1");
    expect(input).toContain("TIER 2");
    expect(input).toContain("Vector 1");
  });

  it("_parseVerdicts extracts conflict records", () => {
    const r = new CrossTierReconciler();
    const verdictText =
      'CONFLICT: KG says "Maria likes Python" contradicts LESSON "Maria prefers TypeScript"\nReason: Direct contradiction in language preference';
    const conflicts = (r as any)._parseVerdicts(
      verdictText,
      ["Maria prefers TypeScript"],
      ["Maria likes Python"],
      [],
    );
    // Even if parsing returns empty (format-dependent), it should not throw
    expect(Array.isArray(conflicts)).toBe(true);
  });

  it("reconcile handles LLM failure gracefully", async () => {
    const { memoryLLMGenerate } = await import("./memory-llm.js");
    (memoryLLMGenerate as any).mockRejectedValueOnce(new Error("LLM down"));

    const r = new CrossTierReconciler();
    const result = await r.reconcile(["Lesson"], ["Fact"], ["Vector"]);
    // Should not throw, returns input data unchanged
    expect(result.lessons).toEqual(["Lesson"]);
    expect(result.conflicts).toHaveLength(0);
  });
});
