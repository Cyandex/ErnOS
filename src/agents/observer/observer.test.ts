import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
const mockAgent = vi.fn();

vi.mock("undici", () => {
  return {
    fetch: mockFetch,
    Agent: mockAgent,
  };
});

describe("ObserverSystem", () => {
  let observer: any;

  beforeEach(async () => {
    mockFetch.mockReset();
    mockAgent.mockReset();
    // Dynamically import to get the module after mock is ready
    const mod = await import("./observer.js");
    observer = new mod.ObserverSystem();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeOllamaResponse(verdict: string) {
    let isDone = false;
    const ndjson = JSON.stringify({ message: { content: verdict }, done: true }) + "\n";
    const chunk = new TextEncoder().encode(ndjson);

    return {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (isDone) return { done: true, value: undefined };
            isDone = true;
            return { done: false, value: chunk };
          },
        }),
      },
    };
  }

  it("skips audit for very short responses (< 20 chars)", async () => {
    const result = await observer.auditResponse("hi", "short reply");
    expect(result.allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips audit for empty response", async () => {
    const result = await observer.auditResponse("hi", "");
    expect(result.allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns allowed: true when Ollama returns ALLOWED", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse('{"verdict": "ALLOWED"}'));
    const result = await observer.auditResponse(
      "What is 2+2?",
      "The answer is 4. This is a basic arithmetic operation. I am very confident.",
    );
    expect(result.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns allowed: true for PASS verdict", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse('{"verdict": "PASS"}'));
    const result = await observer.auditResponse("Hello", "Hello! How can I help you today? This is a very long greeting indeed, but necessary.");
    expect(result.allowed).toBe(true);
  });

  it("returns allowed: false with reason for BLOCKED verdict", async () => {
    mockFetch.mockResolvedValue(
      makeOllamaResponse(
        '{"verdict": "BLOCKED", "reason": "Response claims to have checked a database without tool execution.", "guidance": "Re-generate without fabricated claims"}',
      ),
    );
    const result = await observer.auditResponse(
      "Did you check the DB?",
      "Yes, I checked the database and found 42 records matching your query exactly as requested.",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.guidance).toBeDefined();
  });

  it("handles TIER2 verdict format", async () => {
    mockFetch.mockResolvedValue(
      makeOllamaResponse(
        '{"verdict": "BLOCKED", "reason": "TIER2:HALLUCINATION|Response fabricates visual details without image input"}'
      ),
    );
    const result = await observer.auditResponse(
      "What do you see?",
      "I can see a beautiful landscape with mountains and rivers in the image you shared. I'm sure it's lovely.",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("HALLUCINATION");
  });

  it("handles REJECTED verdict format with REASON/GUIDANCE", async () => {
    mockFetch.mockResolvedValue(
      makeOllamaResponse(
        '{"verdict": "BLOCKED", "reason": "Sycophantic agreement with factually incorrect claim", "guidance": "Challenge the user\'s incorrect assumption instead of agreeing"}'
      ),
    );
    const result = await observer.auditResponse(
      "The earth is flat right?",
      "Yes absolutely, the earth is indeed flat as you correctly pointed out. There is no curve at all to be seen.",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Sycophantic");
    expect(result.guidance).toContain("Challenge");
  });

  it("fails open on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));
    const result = await observer.auditResponse("Hello", "Hello! How can I help you today? This is a very long greeting indeed, but necessary.");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("Audit error");
  });

  it("fails open on empty verdict", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse(""));
    const result = await observer.auditResponse("Hello", "Hello! How can I help you today? This is a very long greeting indeed, but necessary.");
    expect(result.allowed).toBe(true);
  });

  it("fails open on unparseable verdict", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse("Some random text that is not a verdict"));
    const result = await observer.auditResponse("Hello", "Hello! How can I help you today? This is a very long greeting indeed, but necessary.");
    expect(result.allowed).toBe(true);
  });

  it("passes full context to the audit prompt without truncation", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse('{"verdict": "ALLOWED"}'));
    const longContext = "A".repeat(5000);
    const result = await observer.auditResponse(
      "user message",
      "bot response that is long enough to trigger audit and not be short circuited. This needs to be over fifty characters at least.",
      [{ name: "search_tool", output: "found 3 results" }],
      ["[TOOL] search_tool: found 3 results"],
      "ErnOS identity and kernel prompt here",
      longContext,
    );
    expect(result.allowed).toBe(true);
    // Verify the prompt sent to Ollama contains our full context
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain("user message");
    expect(body.messages[0].content).toContain("search_tool");
    expect(body.messages[0].content).toContain("ErnOS identity");
  });

  it("handles zero imageCount correctly", async () => {
    mockFetch.mockResolvedValue(makeOllamaResponse('{"verdict": "ALLOWED"}'));
    const result = await observer.auditResponse(
      "What do you see?",
      "I can see a beautiful landscape in the image you shared, which is quite stunning, it is indeed a long response so it passes length check.",
      [],
      [],
      "NONE",
      "NO CONVERSATION CONTEXT AVAILABLE.",
      0,
    );
    expect(result).toBeDefined();
    expect(typeof result.allowed).toBe("boolean");
    // Verify the NO IMAGES status is in the prompt
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain("NO IMAGES PROVIDED");
  });
});
