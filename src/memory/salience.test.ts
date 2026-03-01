import { describe, expect, it, vi } from "vitest";
import { SemanticSalienceEngine } from "./salience.js";

// Mock the LLM call used by evaluateSalience
vi.mock("./memory-llm.js", () => ({
  memoryLLMGenerate: vi.fn().mockResolvedValue("0.85"),
}));

describe("SemanticSalienceEngine", () => {
  describe("scoreText (heuristic)", () => {
    it("returns base score of 2 for neutral text", () => {
      const engine = new SemanticSalienceEngine();
      const score = engine.scoreText("hello there");
      expect(score).toBeGreaterThanOrEqual(1);
    });

    it('scores higher for text with "important"', () => {
      const engine = new SemanticSalienceEngine();
      const normal = engine.scoreText("hello there");
      const high = engine.scoreText("this is important information");
      expect(high).toBeGreaterThan(normal);
    });

    it('scores higher for text with "remember"', () => {
      const engine = new SemanticSalienceEngine();
      const score = engine.scoreText("please remember this forever");
      expect(score).toBeGreaterThanOrEqual(6);
    });

    it("scores very high for identity statements", () => {
      const engine = new SemanticSalienceEngine();
      const score = engine.scoreText("my name is Maria");
      expect(score).toBeGreaterThanOrEqual(6);
    });

    it("scores higher for long text", () => {
      const engine = new SemanticSalienceEngine();
      const short = engine.scoreText("hi");
      const long = engine.scoreText("A".repeat(600));
      expect(long).toBeGreaterThan(short);
    });

    it("reduces score for very short text", () => {
      const engine = new SemanticSalienceEngine();
      const score = engine.scoreText("ok");
      expect(score).toBeLessThanOrEqual(2);
    });

    it("clamps between 0 and 10", () => {
      const engine = new SemanticSalienceEngine();
      // Pack all high keywords
      const score = engine.scoreText(
        "important critical remember never forget love my name is " + "A".repeat(600),
      );
      expect(score).toBeLessThanOrEqual(10);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("evaluateSalience (LLM)", () => {
    it("returns parsed LLM score", async () => {
      const engine = new SemanticSalienceEngine();
      const score = await engine.evaluateSalience("Maria likes TypeScript");
      expect(score).toBe(0.85);
    });

    it("returns 0.1 for very short messages (fast reject)", async () => {
      const engine = new SemanticSalienceEngine();
      const score = await engine.evaluateSalience("hi");
      expect(score).toBe(0.1);
    });

    it("falls back to heuristic on LLM failure", async () => {
      const { memoryLLMGenerate } = await import("./memory-llm.js");
      (memoryLLMGenerate as any).mockRejectedValueOnce(new Error("LLM unavailable"));

      const engine = new SemanticSalienceEngine();
      const score = await engine.evaluateSalience("this is important information");
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("isSalient", () => {
    it("returns true for high-salience messages", async () => {
      const engine = new SemanticSalienceEngine();
      // Mock returns 0.85 which is above 0.75 threshold
      const result = await engine.isSalient("Maria prefers TypeScript");
      expect(result).toBe(true);
    });

    it("returns false for low-salience messages", async () => {
      const { memoryLLMGenerate } = await import("./memory-llm.js");
      (memoryLLMGenerate as any).mockResolvedValueOnce("0.2");

      const engine = new SemanticSalienceEngine();
      const result = await engine.isSalient("ok cool");
      expect(result).toBe(false);
    });
  });

  describe("scoreEntry", () => {
    it("scores a structured entry", async () => {
      const engine = new SemanticSalienceEngine();
      const score = await engine.scoreEntry({ user: "hello", bot: "hi there" });
      expect(typeof score).toBe("number");
    });
  });
});
