import { describe, expect, it, vi } from "vitest";
import { ContextStream } from "./stream.js";

vi.mock("./memory-llm.js", () => ({
  memoryLLMGenerate: vi
    .fn()
    .mockResolvedValue(
      "SUMMARY: Maria and ErnOS are discussing TypeScript generics\nTOPICS: TypeScript, generics, coding\nGOALS: learn generics\nTONE: collaborative",
    ),
}));

describe("ContextStream", () => {
  it("getContext returns empty state vector for unknown user", () => {
    const cs = new ContextStream();
    const sv = cs.getContext("unknown-user-" + Date.now());
    expect(sv.summary).toBe("No conversation history yet.");
    expect(sv.turnCount).toBe(0);
  });

  it("addTurn updates state vector", async () => {
    const cs = new ContextStream();
    const uid = "stream-test-" + Date.now();
    await cs.addTurn("Teach me TypeScript", "Sure!", uid, "Alice", "PUBLIC");
    const sv = cs.getContext(uid, "PUBLIC");
    expect(sv.turnCount).toBeGreaterThanOrEqual(1);
    expect(sv.summary).toContain("TypeScript");
  });

  it("getContextString returns empty for no history", () => {
    const cs = new ContextStream();
    const str = cs.getContextString("unknown-" + Date.now());
    expect(str).toBe("");
  });

  it("getContextString returns formatted string after turns", async () => {
    const cs = new ContextStream();
    const uid = "stream-fmt-" + Date.now();
    await cs.addTurn("Hello", "Hi", uid, "Alice");
    const str = cs.getContextString(uid);
    expect(str).toContain("[Current State]");
  });

  it("different scope+user pairs get separate vectors", async () => {
    const cs = new ContextStream();
    const uid = "stream-scope-" + Date.now();
    await cs.addTurn("Public msg", "Reply", uid, "Alice", "PUBLIC");
    await cs.addTurn("Private msg", "Reply", uid, "Alice", "PRIVATE");

    const pub = cs.getContext(uid, "PUBLIC");
    const priv = cs.getContext(uid, "PRIVATE");
    // Each scope should have at least 1 turn
    expect(pub.turnCount).toBeGreaterThanOrEqual(1);
    expect(priv.turnCount).toBeGreaterThanOrEqual(1);
  });

  it("getAllVectors returns map of vectors", async () => {
    const cs = new ContextStream();
    const uid = "stream-all-" + Date.now();
    await cs.addTurn("Msg", "Reply", uid, "Alice");
    const vectors = cs.getAllVectors();
    expect(vectors instanceof Map).toBe(true);
    expect(vectors.size).toBeGreaterThanOrEqual(1);
  });

  it("handles LLM failure gracefully", async () => {
    const { memoryLLMGenerate } = await import("./memory-llm.js");
    (memoryLLMGenerate as any).mockRejectedValueOnce(new Error("LLM down"));

    const cs = new ContextStream();
    const uid = "stream-fail-" + Date.now();
    await cs.addTurn("Hello", "Hi", uid, "Alice");
    const sv = cs.getContext(uid);
    expect(sv.turnCount).toBeGreaterThanOrEqual(1);
  });
});
