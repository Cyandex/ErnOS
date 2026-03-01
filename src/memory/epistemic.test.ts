import { describe, expect, it } from "vitest";
import { EpistemicContext, SourceTier, SourceTag, EpistemicTracker } from "./epistemic.js";

describe("SourceTag", () => {
  it("tags text with a source tier marker", () => {
    const tagged = SourceTag.tag("Maria likes TypeScript", SourceTier.KG);
    expect(tagged).toContain("[SRC:KG]");
    expect(tagged).toContain("Maria likes TypeScript");
  });

  it("tagList tags multiple items", () => {
    const items = ["Fact 1", "Fact 2"];
    const tagged = SourceTag.tagList(items, SourceTier.VS);
    expect(tagged).toHaveLength(2);
    expect(tagged[0]).toContain("[SRC:VS]");
  });

  it("extract recovers tier and clean text", () => {
    const tagged = SourceTag.tag("Some fact", SourceTier.WM);
    const { tier, cleanText } = SourceTag.extract(tagged);
    expect(tier).toBe(SourceTier.WM);
    expect(cleanText).toContain("Some fact");
  });

  it("extract returns null tier for untagged text", () => {
    const { tier } = SourceTag.extract("Just plain text");
    expect(tier).toBeNull();
  });
});

describe("EpistemicContext", () => {
  it("starts with no sources", () => {
    const ctx = new EpistemicContext();
    expect(ctx.getActiveTiers()).toHaveLength(0);
  });

  it("addSource records tier attribution", () => {
    const ctx = new EpistemicContext();
    ctx.addSource(SourceTier.KG, "Maria likes TypeScript");
    const tiers = ctx.getActiveTiers();
    expect(tiers).toContain(SourceTier.KG);
  });

  it("addSources records multiple items from same tier", () => {
    const ctx = new EpistemicContext();
    ctx.addSources(SourceTier.VS, ["Memory 1", "Memory 2"]);
    const items = ctx.getFromTier(SourceTier.VS);
    expect(items).toHaveLength(2);
  });

  it("getSourceSummary returns human-readable summary", () => {
    const ctx = new EpistemicContext();
    ctx.addSource(SourceTier.KG, "Fact from KG");
    ctx.addSource(SourceTier.LS, "Lesson learned");
    const summary = ctx.getSourceSummary();
    expect(summary).toContain("KG");
    expect(summary).toContain("LS");
  });

  it("toJSON serializes correctly", () => {
    const ctx = new EpistemicContext("turn-123");
    ctx.addSource(SourceTier.WM, "Recent context");
    const json = ctx.toJSON();
    expect(json.turnId).toBe("turn-123");
    expect(json.sources).toBeDefined();
  });
});

describe("EpistemicTracker", () => {
  it("recordFact stores and returns an EpistemicFact", () => {
    const tracker = new EpistemicTracker();
    const fact = tracker.recordFact("fact-1", "conversation", 0.85, SourceTier.KG);
    expect(fact.factId).toBe("fact-1");
    expect(fact.confidence).toBe(0.85);
    expect(fact.certainty).toBe("High");
  });

  it("getFactReliability retrieves stored fact", () => {
    const tracker = new EpistemicTracker();
    tracker.recordFact("fact-1", "test", 0.9);
    const fact = tracker.getFactReliability("fact-1");
    expect(fact).toBeDefined();
    expect(fact!.confidence).toBe(0.9);
  });

  it("getFactReliability returns undefined for unknown fact", () => {
    const tracker = new EpistemicTracker();
    expect(tracker.getFactReliability("nonexistent")).toBeUndefined();
  });

  it("registerContradiction tracks opposing facts", () => {
    const tracker = new EpistemicTracker();
    tracker.recordFact("fact-1", "source-a", 0.9);
    tracker.registerContradiction("fact-1", "fact-2");
    const fact = tracker.getFactReliability("fact-1");
    expect(fact!.contradictionsFound).toContain("fact-2");
  });

  it("getReliableFacts filters by confidence threshold", () => {
    const tracker = new EpistemicTracker();
    tracker.recordFact("high", "test", 0.9);
    tracker.recordFact("low", "test", 0.3);
    const reliable = tracker.getReliableFacts(0.6);
    expect(reliable).toHaveLength(1);
    expect(reliable[0].factId).toBe("high");
  });

  it("getContestedFacts returns facts with contradictions", () => {
    const tracker = new EpistemicTracker();
    tracker.recordFact("clean", "test", 0.9);
    tracker.recordFact("contested", "test", 0.8);
    tracker.registerContradiction("contested", "opposing");
    const contested = tracker.getContestedFacts();
    expect(contested).toHaveLength(1);
    expect(contested[0].factId).toBe("contested");
  });

  it("certainty label maps correctly", () => {
    const tracker = new EpistemicTracker();
    expect(tracker.recordFact("a", "s", 0.95).certainty).toBe("Absolute");
    expect(tracker.recordFact("b", "s", 0.85).certainty).toBe("High");
    expect(tracker.recordFact("c", "s", 0.65).certainty).toBe("Moderate");
    expect(tracker.recordFact("d", "s", 0.3).certainty).toBe("Speculative");
  });
});
