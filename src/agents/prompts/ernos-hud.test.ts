import { describe, it, expect } from "vitest";
import { buildErnosHud, buildErnosForkHud, type HudData } from "./ernos-hud.js";

describe("buildErnosHud", () => {
  it("returns empty string when no data provided", () => {
    expect(buildErnosHud({})).toBe("");
  });

  it("renders active goals section", () => {
    const hud = buildErnosHud({ activeGoals: ["Fix bug #42", "Deploy v4"] });
    expect(hud).toContain("### Active Goals");
    expect(hud).toContain("- Fix bug #42");
    expect(hud).toContain("- Deploy v4");
  });

  it("caps active goals at 10", () => {
    const goals = Array.from({ length: 15 }, (_, i) => `Goal ${i}`);
    const hud = buildErnosHud({ activeGoals: goals });
    expect(hud).toContain("- Goal 9");
    expect(hud).not.toContain("- Goal 10");
  });

  it("renders subsystem health with icons", () => {
    const hud = buildErnosHud({
      subsystemHealth: {
        Memory: "ONLINE",
        KG: "DEGRADED",
        Observer: "OFFLINE",
        TTS: "UNKNOWN",
      },
    });
    expect(hud).toContain("🟢 Memory: ONLINE");
    expect(hud).toContain("🟡 KG: DEGRADED");
    expect(hud).toContain("🔴 Observer: OFFLINE");
    expect(hud).toContain("⚪ TTS: UNKNOWN");
  });

  it("renders KG snapshot", () => {
    const hud = buildErnosHud({
      kgSnapshot: [{ subject: "ErnOS", predicate: "is", object: "autonomous" }],
    });
    expect(hud).toContain("### Knowledge Graph (Recent)");
    expect(hud).toContain("ErnOS → is → autonomous");
  });

  it("caps KG snapshot at 20", () => {
    const triples = Array.from({ length: 25 }, (_, i) => ({
      subject: `S${i}`,
      predicate: "rel",
      object: `O${i}`,
    }));
    const hud = buildErnosHud({ kgSnapshot: triples });
    expect(hud).toContain("S19");
    expect(hud).not.toContain("S20");
  });

  it("renders lessons", () => {
    const hud = buildErnosHud({ lessons: ["Never trust empty arrays"] });
    expect(hud).toContain("### Crystallized Lessons");
    expect(hud).toContain("- Never trust empty arrays");
  });

  it("renders working memory summary", () => {
    const hud = buildErnosHud({ workingMemorySummary: "User is debugging a memory leak" });
    expect(hud).toContain("### Working Memory");
    expect(hud).toContain("User is debugging a memory leak");
  });

  it("renders tape state", () => {
    const hud = buildErnosHud({ tapeState: "Step 5: Verified claim via search" });
    expect(hud).toContain("### Internal Monologue (Tape)");
    expect(hud).toContain("Step 5: Verified claim via search");
  });

  it("renders inner state", () => {
    const hud = buildErnosHud({ innerState: "Curious and engaged" });
    expect(hud).toContain("### Inner State");
    expect(hud).toContain("Curious and engaged");
  });

  it("renders autonomy log", () => {
    const hud = buildErnosHud({ autonomyLog: ["Checked KG health", "Ran dream consolidation"] });
    expect(hud).toContain("### Autonomous Thoughts");
    expect(hud).toContain("- Checked KG health");
    expect(hud).toContain("- Ran dream consolidation");
  });

  // === NEW V3 HUD FIELDS ===

  it("renders tool call history", () => {
    const hud = buildErnosHud({
      toolCallHistory: ['web_search("latest AI news")', 'read("src/bot.ts")'],
    });
    expect(hud).toContain("### Recent Tool Calls");
    expect(hud).toContain('- web_search("latest AI news")');
    expect(hud).toContain('- read("src/bot.ts")');
  });

  it("caps tool call history at 20", () => {
    const calls = Array.from({ length: 25 }, (_, i) => `tool_${i}()`);
    const hud = buildErnosHud({ toolCallHistory: calls });
    expect(hud).toContain("- tool_19()");
    expect(hud).not.toContain("- tool_20()");
  });

  it("renders proactive intentions", () => {
    const hud = buildErnosHud({
      proactiveIntentions: ["Check in with user about project X", "Run KG health check"],
    });
    expect(hud).toContain("### Proactive Intentions");
    expect(hud).toContain("- Check in with user about project X");
    expect(hud).toContain("- Run KG health check");
  });

  it("caps proactive intentions at 5", () => {
    const intents = Array.from({ length: 8 }, (_, i) => `Intent ${i}`);
    const hud = buildErnosHud({ proactiveIntentions: intents });
    expect(hud).toContain("- Intent 4");
    expect(hud).not.toContain("- Intent 5");
  });

  it("renders recent errors", () => {
    const hud = buildErnosHud({
      recentErrors: ["TypeError: Cannot read properties of undefined", "KG connection timeout"],
    });
    expect(hud).toContain("### Recent Errors");
    expect(hud).toContain("- TypeError: Cannot read properties of undefined");
    expect(hud).toContain("- KG connection timeout");
  });

  it("caps recent errors at 10", () => {
    const errors = Array.from({ length: 15 }, (_, i) => `Error ${i}`);
    const hud = buildErnosHud({ recentErrors: errors });
    expect(hud).toContain("- Error 9");
    expect(hud).not.toContain("- Error 10");
  });

  it("renders flux status", () => {
    const hud = buildErnosHud({ fluxStatus: "Web: 3/5 remaining | Image: 4/5 remaining" });
    expect(hud).toContain("### Rate Limits");
    expect(hud).toContain("Web: 3/5 remaining | Image: 4/5 remaining");
  });

  it("renders dream journal", () => {
    const hud = buildErnosHud({ dreamJournal: "Last dream cycle: consolidated 42 memories" });
    expect(hud).toContain("### Dream Journal");
    expect(hud).toContain("Last dream cycle: consolidated 42 memories");
  });

  it("renders temporal context", () => {
    const hud = buildErnosHud({ temporalContext: "Session: 45min | Last interaction: 2min ago" });
    expect(hud).toContain("### Temporal Awareness");
    expect(hud).toContain("Session: 45min | Last interaction: 2min ago");
  });

  it("omits empty arrays for new fields", () => {
    const hud = buildErnosHud({
      toolCallHistory: [],
      proactiveIntentions: [],
      recentErrors: [],
    });
    expect(hud).toBe("");
  });

  it("renders full HUD with all fields populated", () => {
    const full: HudData = {
      activeGoals: ["Ship v4"],
      subsystemHealth: { Memory: "ONLINE" },
      kgSnapshot: [{ subject: "A", predicate: "B", object: "C" }],
      lessons: ["Lesson 1"],
      workingMemorySummary: "Context here",
      tapeState: "Step 1",
      innerState: "Focused",
      autonomyLog: ["Thought 1"],
      toolCallHistory: ['web_search("test")'],
      proactiveIntentions: ["Check KG"],
      recentErrors: ["Timeout"],
      fluxStatus: "All good",
      dreamJournal: "Dream log",
      temporalContext: "Session: 10min",
    };
    const hud = buildErnosHud(full);
    expect(hud).toContain("## Ernos HUD (Live Context)");
    expect(hud).toContain("### Active Goals");
    expect(hud).toContain("### Subsystem Health");
    expect(hud).toContain("### Knowledge Graph (Recent)");
    expect(hud).toContain("### Crystallized Lessons");
    expect(hud).toContain("### Working Memory");
    expect(hud).toContain("### Internal Monologue (Tape)");
    expect(hud).toContain("### Inner State");
    expect(hud).toContain("### Autonomous Thoughts");
    expect(hud).toContain("### Recent Tool Calls");
    expect(hud).toContain("### Proactive Intentions");
    expect(hud).toContain("### Recent Errors");
    expect(hud).toContain("### Rate Limits");
    expect(hud).toContain("### Dream Journal");
    expect(hud).toContain("### Temporal Awareness");
  });
});

describe("buildErnosForkHud", () => {
  it("returns empty string when no data provided", () => {
    expect(buildErnosForkHud({})).toBe("");
  });

  it("renders relationship summary with message count", () => {
    const hud = buildErnosForkHud({
      userName: "Maria",
      relationshipSummary: "Close collaborator since Feb 2025",
      messageCount: 1500,
    });
    expect(hud).toContain("## HUD — Maria");
    expect(hud).toContain("### Shared Story");
    expect(hud).toContain("Close collaborator since Feb 2025");
    expect(hud).toContain("Messages exchanged: ~1500");
  });

  it("renders topic memory", () => {
    const hud = buildErnosForkHud({
      topicMemory: ["ErnOS architecture", "Tape machine"],
    });
    expect(hud).toContain("### Topic Memory");
    expect(hud).toContain("- ErnOS architecture");
  });

  it("renders shared language", () => {
    const hud = buildErnosForkHud({
      sharedLanguage: { nuke: "Full system reset" },
    });
    expect(hud).toContain("### Shared Language");
    expect(hud).toContain("**nuke**: Full system reset");
  });

  it("renders emotional context", () => {
    const hud = buildErnosForkHud({
      emotionalContext: "Engaged and productive",
    });
    expect(hud).toContain("### Emotional Context");
    expect(hud).toContain("Engaged and productive");
  });

  it("uses generic header when no userName", () => {
    const hud = buildErnosForkHud({
      emotionalContext: "Neutral",
    });
    expect(hud).toContain("## HUD (Private)");
  });
});
