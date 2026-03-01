import { describe, expect, it } from "vitest";
import { createCognitiveLoop, feedChunk, registerToolCall, getWarnings } from "./cognitive-loop.js";

describe("CognitiveLoop", () => {
  it("detects ghost tool claims when no tools were called", () => {
    const state = createCognitiveLoop(0);
    // Feed enough text to trigger pattern check (200 char threshold)
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I checked the database and found 42 records.");
    const warnings = getWarnings(state);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("GHOST_TOOL");
  });

  it("does NOT warn about tools when a tool was actually called", () => {
    const state = createCognitiveLoop(0);
    registerToolCall(state, "database_query");
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I checked the database and found 42 records.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("GHOST_TOOL"))).toBe(false);
  });

  it("detects fabricated citations without memory_search", () => {
    const state = createCognitiveLoop(0);
    const padding = "A".repeat(200);
    feedChunk(state, padding + " According to the official documentation, this is correct.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("FABRICATED_CITATION"))).toBe(true);
  });

  it("does NOT warn about citations when memory_search was called", () => {
    const state = createCognitiveLoop(0);
    registerToolCall(state, "memory_search");
    const padding = "A".repeat(200);
    feedChunk(state, padding + " According to the documentation, this is correct.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("FABRICATED_CITATION"))).toBe(false);
  });

  it("detects image hallucination when imageCount is 0", () => {
    const state = createCognitiveLoop(0); // No images
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I can see a beautiful landscape in the image you shared.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("IMAGE_HALLUCINATION"))).toBe(true);
  });

  it("does NOT warn about images when imageCount > 0", () => {
    const state = createCognitiveLoop(2); // Has images
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I can see a beautiful landscape in the image you shared.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("IMAGE_HALLUCINATION"))).toBe(false);
  });

  it("detects unfounded confidence without tool evidence", () => {
    const state = createCognitiveLoop(0);
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I can definitely confirm that this is absolutely correct.");
    const warnings = getWarnings(state);
    expect(warnings.some((w) => w.includes("UNFOUNDED_CONFIDENCE"))).toBe(true);
  });

  it("does not duplicate warnings on repeated chunks", () => {
    const state = createCognitiveLoop(0);
    const padding = "A".repeat(200);
    feedChunk(state, padding + " I checked the database twice.");
    feedChunk(state, "A".repeat(200) + " I checked the database again.");
    const warnings = getWarnings(state);
    const ghostCount = warnings.filter((w) => w.includes("GHOST_TOOL")).length;
    expect(ghostCount).toBe(1); // Should only be counted once
  });

  it("only checks every 200 chars to avoid thrashing", () => {
    const state = createCognitiveLoop(0);
    // Feed less than 200 chars — should NOT trigger check
    feedChunk(state, "I checked the database.");
    expect(getWarnings(state)).toHaveLength(0);
    // Feed padding to hit 200 chars — NOW it should trigger
    feedChunk(state, "A".repeat(200));
    expect(getWarnings(state).length).toBeGreaterThan(0);
  });

  it("returns empty warnings for clean text", () => {
    const state = createCognitiveLoop(0);
    const padding = "A".repeat(200);
    feedChunk(state, padding + " Hello, how can I help you today? I would be happy to assist.");
    const warnings = getWarnings(state);
    expect(warnings).toHaveLength(0);
  });
});
