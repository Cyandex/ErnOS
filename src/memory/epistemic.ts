/**
 * Epistemic System — Source Tracking & Claim Introspection
 *
 * Tracks where recalled information came from (which memory tier) and provides
 * tools for ErnOS to introspect claims by searching all memory tiers for evidence.
 *
 * Key capabilities:
 * - SourceTier enum for all memory tiers
 * - Per-turn source tagging with inline [SRC:KG] markers
 * - EpistemicContext class for accumulating source references
 * - introspect_claim() for deep evidence search across all tiers
 * - EpistemicTracker for fact reliability tracking with contradiction handling
 *
 * Ported from V3: src/memory/epistemic.py (300 lines)
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { memoryLLMGenerate } from "./memory-llm.js";

const log = createSubsystemLogger("epistemic");

// ─── Source Tier Enum ────────────────────────────────────────────────────

/** All memory tiers that can be a source of information. */
export enum SourceTier {
  /** Knowledge Graph — structured facts */
  KG = "KG",
  /** Vector Store — semantic conversational history */
  VS = "VS",
  /** Working Memory — recent conversation buffer */
  WM = "WM",
  /** Lessons — user-verified truths */
  LS = "LS",
  /** Facts/Notes — explicit user-provided facts */
  FN = "FN",
  /** Timeline — chronological events */
  TL = "TL",
  /** Chroma/Embeddings — embedding-based retrieval */
  CH = "CH",
  /** User Profile — stored preferences and profile data */
  UP = "UP",
  /** Reconciler — conflict-resolved data */
  RC = "RC",
  /** Stream — context stream / state vector */
  ST = "ST",
}

// ─── Source Tag ──────────────────────────────────────────────────────────

/** Inline source marker format: [SRC:KG], [SRC:VS], etc. */
export class SourceTag {
  static tag(text: string, tier: SourceTier): string {
    return `[SRC:${tier}] ${text}`;
  }

  static tagList(items: string[], tier: SourceTier): string[] {
    return items.map((item) => SourceTag.tag(item, tier));
  }

  /** Extract source tier from a tagged string, if present. */
  static extract(text: string): { tier: SourceTier | null; cleanText: string } {
    const match = /^\[SRC:([A-Z]{2})\]\s*(.*)$/s.exec(text);
    if (match) {
      const tierStr = match[1] as keyof typeof SourceTier;
      return {
        tier: SourceTier[tierStr] ?? null,
        cleanText: match[2],
      };
    }
    return { tier: null, cleanText: text };
  }
}

// ─── Epistemic Context ──────────────────────────────────────────────────

/** Per-turn source tracking. Accumulates which tiers contributed to the current recall. */
export class EpistemicContext {
  private sources: Map<SourceTier, string[]> = new Map();
  private turnId: string;

  constructor(turnId?: string) {
    this.turnId = turnId || `turn-${Date.now()}`;
  }

  /** Record that a piece of information came from a specific tier. */
  addSource(tier: SourceTier, text: string): void {
    if (!this.sources.has(tier)) {
      this.sources.set(tier, []);
    }
    this.sources.get(tier)!.push(text);
  }

  /** Record multiple items from the same tier. */
  addSources(tier: SourceTier, texts: string[]): void {
    for (const text of texts) {
      this.addSource(tier, text);
    }
  }

  /** Get all source tiers that contributed to this turn. */
  getActiveTiers(): SourceTier[] {
    return Array.from(this.sources.keys());
  }

  /** Get items from a specific tier. */
  getFromTier(tier: SourceTier): string[] {
    return this.sources.get(tier) || [];
  }

  /** Get a human-readable summary of sources. */
  getSourceSummary(): string {
    if (this.sources.size === 0) return "No sources tracked.";

    const parts: string[] = [];
    for (const [tier, items] of this.sources) {
      parts.push(`${tier}: ${items.length} item${items.length !== 1 ? "s" : ""}`);
    }
    return `Sources: ${parts.join(", ")}`;
  }

  /** Export to a plain object for serialization. */
  toJSON(): Record<string, any> {
    const obj: Record<string, string[]> = {};
    for (const [tier, items] of this.sources) {
      obj[tier] = items;
    }
    return { turnId: this.turnId, sources: obj };
  }
}

// ─── Fact Reliability Tracking ──────────────────────────────────────────

export interface EpistemicFact {
  factId: string;
  source: string;
  sourceTier: SourceTier;
  confidence: number; // 0.0 to 1.0
  certainty: "Absolute" | "High" | "Moderate" | "Speculative";
  contradictionsFound: string[];
  firstSeen: number;
  lastVerified: number;
}

export class EpistemicTracker {
  private records: Map<string, EpistemicFact> = new Map();

  public recordFact(
    factId: string,
    source: string,
    confidence: number,
    sourceTier: SourceTier = SourceTier.KG,
  ): EpistemicFact {
    let certainty: EpistemicFact["certainty"] = "Moderate";
    if (confidence >= 0.95) certainty = "Absolute";
    else if (confidence >= 0.8) certainty = "High";
    else if (confidence <= 0.4) certainty = "Speculative";

    const now = Date.now();
    const existing = this.records.get(factId);

    const fact: EpistemicFact = {
      factId,
      source,
      sourceTier,
      confidence,
      certainty,
      contradictionsFound: existing?.contradictionsFound || [],
      firstSeen: existing?.firstSeen || now,
      lastVerified: now,
    };
    this.records.set(factId, fact);
    return fact;
  }

  public getFactReliability(factId: string): EpistemicFact | undefined {
    return this.records.get(factId);
  }

  public registerContradiction(factId: string, opposingFactId: string): void {
    const fact = this.records.get(factId);
    if (fact && !fact.contradictionsFound.includes(opposingFactId)) {
      fact.contradictionsFound.push(opposingFactId);
      fact.confidence *= 0.8; // Reduce confidence on contradiction
      if (fact.confidence < 0.4) fact.certainty = "Speculative";
    }
  }

  /** Get all facts above a confidence threshold. */
  public getReliableFacts(minConfidence: number = 0.6): EpistemicFact[] {
    return Array.from(this.records.values()).filter((f) => f.confidence >= minConfidence);
  }

  /** Get facts with unresolved contradictions. */
  public getContestedFacts(): EpistemicFact[] {
    return Array.from(this.records.values()).filter((f) => f.contradictionsFound.length > 0);
  }
}

// ─── Claim Introspection ────────────────────────────────────────────────

const INTROSPECT_PROMPT = `You are ErnOS's epistemic introspection engine.
A claim has been made and you need to evaluate it against the evidence found across multiple memory tiers.

For each piece of evidence, assess whether it:
- SUPPORTS the claim (with what strength: strong/moderate/weak)
- CONTRADICTS the claim (with what strength: strong/moderate/weak)  
- Is IRRELEVANT to the claim

Then provide an overall VERDICT:
- CONFIRMED — strong evidence supports the claim
- LIKELY — moderate evidence supports, no contradictions
- UNCERTAIN — mixed or insufficient evidence
- DISPUTED — contradictions found
- UNVERIFIED — no evidence found

Respond in this format:
EVIDENCE:
[tier]:[index] — [SUPPORTS|CONTRADICTS|IRRELEVANT] ([strength]) — [brief reason]
...

VERDICT: [CONFIRMED|LIKELY|UNCERTAIN|DISPUTED|UNVERIFIED]
CONFIDENCE: [0.0 to 1.0]
REASONING: [1-2 sentence summary]`;

export interface IntrospectionResult {
  claim: string;
  verdict: "CONFIRMED" | "LIKELY" | "UNCERTAIN" | "DISPUTED" | "UNVERIFIED";
  confidence: number;
  reasoning: string;
  evidence: Array<{
    tier: string;
    text: string;
    assessment: "SUPPORTS" | "CONTRADICTS" | "IRRELEVANT";
    strength: string;
  }>;
}

/**
 * Search all memory tiers for evidence about a claim, then use LLM to assess.
 *
 * This is ErnOS's "epistemic self-check" — it can verify whether something
 * it believes is actually supported by its own memory.
 */
export async function introspectClaim(
  claim: string,
  memoryContext: {
    lessons?: string[];
    kgFacts?: string[];
    vectorMemories?: string[];
    workingMemory?: string;
    tapeView?: string;
  },
): Promise<IntrospectionResult> {
  // Build evidence summary from all tiers
  const evidenceParts: string[] = [
    `CLAIM TO EVALUATE: "${claim}"\n\nEVIDENCE FROM MEMORY TIERS:\n`,
  ];

  if (memoryContext.lessons?.length) {
    evidenceParts.push("TIER 5 — LESSONS (Highest Authority):");
    memoryContext.lessons.forEach((l, i) => evidenceParts.push(`  LS[${i}]: ${l}`));
  }

  if (memoryContext.kgFacts?.length) {
    evidenceParts.push("\nTIER 3 — KNOWLEDGE GRAPH:");
    memoryContext.kgFacts.forEach((f, i) => evidenceParts.push(`  KG[${i}]: ${f}`));
  }

  if (memoryContext.vectorMemories?.length) {
    evidenceParts.push("\nTIER 2 — VECTOR MEMORIES:");
    memoryContext.vectorMemories.forEach((v, i) =>
      evidenceParts.push(`  VM[${i}]: ${v.slice(0, 300)}`),
    );
  }

  if (memoryContext.workingMemory) {
    evidenceParts.push(
      `\nTIER 1 — WORKING MEMORY:\n  ${memoryContext.workingMemory.slice(0, 500)}`,
    );
  }

  if (memoryContext.tapeView) {
    evidenceParts.push(`\nTIER 5 — TAPE:\n  ${memoryContext.tapeView.slice(0, 300)}`);
  }

  const input = evidenceParts.join("\n");

  try {
    const response = await memoryLLMGenerate(INTROSPECT_PROMPT, input, {
      temperature: 0.2,
      timeoutMs: 25_000,
    });

    return parseIntrospectionResponse(claim, response);
  } catch (err: any) {
    log.warn(`Introspection failed: ${err.message || err}`);
    return {
      claim,
      verdict: "UNVERIFIED",
      confidence: 0,
      reasoning: `Introspection failed: ${err.message || "unknown error"}`,
      evidence: [],
    };
  }
}

function parseIntrospectionResponse(claim: string, response: string): IntrospectionResult {
  // Parse verdict
  const verdictMatch = /VERDICT:\s*(CONFIRMED|LIKELY|UNCERTAIN|DISPUTED|UNVERIFIED)/i.exec(
    response,
  );
  const verdict = (verdictMatch?.[1]?.toUpperCase() ||
    "UNCERTAIN") as IntrospectionResult["verdict"];

  // Parse confidence
  const confidenceMatch = /CONFIDENCE:\s*([\d.]+)/i.exec(response);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

  // Parse reasoning
  const reasoningMatch = /REASONING:\s*(.+)/i.exec(response);
  const reasoning = reasoningMatch?.[1]?.trim() || "No reasoning provided.";

  // Parse evidence items
  const evidence: IntrospectionResult["evidence"] = [];
  const evidencePattern =
    /([A-Z]{2})\[(\d+)\]\s*[-—]\s*(SUPPORTS|CONTRADICTS|IRRELEVANT)\s*\((\w+)\)\s*[-—]\s*(.+)/gi;
  let match;
  while ((match = evidencePattern.exec(response)) !== null) {
    evidence.push({
      tier: match[1],
      text: match[5].trim(),
      assessment: match[3].toUpperCase() as "SUPPORTS" | "CONTRADICTS" | "IRRELEVANT",
      strength: match[4],
    });
  }

  return { claim, verdict, confidence, reasoning, evidence };
}
