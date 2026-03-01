import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the observer module
vi.mock("./observer/observer.js", () => ({
  observer: {
    auditResponse: vi.fn(),
  },
}));

// Mock runEmbeddedPiAgent from the run module
vi.mock("./pi-embedded-runner/run.js", () => ({
  runEmbeddedPiAgent: vi.fn(),
}));

import { runWithObserverAudit } from "./observer-hook.js";
import { observer } from "./observer/observer.js";
import { runEmbeddedPiAgent } from "./pi-embedded-runner/run.js";

const mockAudit = vi.mocked(observer.auditResponse);
const mockRunAgent = vi.mocked(runEmbeddedPiAgent);

describe("runWithObserverAudit", () => {
  beforeEach(() => {
    mockAudit.mockReset();
    mockRunAgent.mockReset();
  });

  it("returns result directly when audit passes", async () => {
    const mockResult = {
      payloads: [{ text: "Hello, I can help with that!" }],
      meta: {},
    };
    mockRunAgent.mockResolvedValue(mockResult as any);
    mockAudit.mockResolvedValue({ allowed: true });

    const result = await runWithObserverAudit({ prompt: "Help me" } as any);
    expect(result).toBe(mockResult);
    expect(mockRunAgent).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it("retries with guidance when audit blocks", async () => {
    const blockedResult = {
      payloads: [{ text: "I checked the database and found your records." }],
      meta: {},
    };
    const passedResult = {
      payloads: [{ text: "I don't have access to check databases." }],
      meta: {},
    };

    mockRunAgent
      .mockResolvedValueOnce(blockedResult as any)
      .mockResolvedValueOnce(passedResult as any);

    mockAudit
      .mockResolvedValueOnce({
        allowed: false,
        reason: "Hallucination: claimed database access without tool",
        guidance: "Do not claim to have checked databases.",
      })
      .mockResolvedValueOnce({ allowed: true });

    const result = await runWithObserverAudit({ prompt: "Check my files" } as any);
    expect(result).toBe(passedResult);
    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    expect(mockAudit).toHaveBeenCalledTimes(2);

    // Verify guidance was injected into the retry
    const retryCall = mockRunAgent.mock.calls[1][0] as any;
    expect(retryCall.extraSystemPrompt).toContain("OBSERVER GUIDANCE");
    expect(retryCall.extraSystemPrompt).toContain("Do not claim to have checked databases");
  });

  it("fails open after max retries", async () => {
    const badResult = {
      payloads: [{ text: "I definitely checked everything and it is all fine." }],
      meta: {},
    };

    mockRunAgent.mockResolvedValue(badResult as any);
    mockAudit.mockResolvedValue({
      allowed: false,
      reason: "Persistent hallucination",
      guidance: "Stop fabricating.",
    });

    const result = await runWithObserverAudit({ prompt: "test" } as any, 2);
    // After 3 blocked attempts (0, 1, 2), it fails open with a final run
    expect(mockRunAgent).toHaveBeenCalledTimes(4); // 3 audited + 1 final unaudited
    expect(result).toBeDefined();
  });

  it("passes system context with expanded limits (not truncated to 2000)", async () => {
    const longSystemPrompt = "X".repeat(5000);
    const longPrompt = "Y".repeat(5000);

    mockRunAgent.mockResolvedValue({
      payloads: [{ text: "A response long enough for audit verification in tests" }],
      meta: {},
    } as any);
    mockAudit.mockResolvedValue({ allowed: true });

    await runWithObserverAudit({
      prompt: longPrompt,
      extraSystemPrompt: longSystemPrompt,
    } as any);

    const auditCall = mockAudit.mock.calls[0];
    const systemContextArg = auditCall[4]; // 5th arg = systemContext
    const conversationContextArg = auditCall[5]; // 6th arg = conversationContext

    // With 8000 char limit, 5000 char inputs should NOT be truncated
    expect(systemContextArg!.length).toBe(5000);
    expect(conversationContextArg!.length).toBe(5000);
  });

  it("collects tool outputs during the run", async () => {
    mockRunAgent.mockImplementation(async (params: any) => {
      // Simulate the onToolResult callback being called
      params.onToolResult?.({ text: "search results: found 3 items" });
      return {
        payloads: [{ text: "Based on the search, I found 3 items matching your query." }],
        meta: { durationMs: 100 },
      } as any;
    });
    mockAudit.mockResolvedValue({ allowed: true });

    await runWithObserverAudit({ prompt: "search for items" } as any);

    const auditCall = mockAudit.mock.calls[0];
    const toolOutputsArg = auditCall[2]; // 3rd arg = toolOutputs
    expect(toolOutputsArg).toHaveLength(1);
    expect(toolOutputsArg![0].output).toContain("search results");
  });
});
