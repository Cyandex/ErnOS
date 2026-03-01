/**
 * Cross-Tier Memory Reconciler (LLM-Powered)
 *
 * Post-retrieval reconciliation between Lessons (T5), Knowledge Graph (T3),
 * and Vector Store (T2) memories. Uses a focused LLM call to detect conflicts
 * where tiers disagree about the same entity, then annotates stale results so
 * the main inference model can make informed epistemic judgments.
 *
 * Runs inside MemoryStore.recall() after all tiers return results.
 * Follows the IntegrityAuditor pattern: structured prompt → structured verdict → act.
 *
 * No heuristics. No regex matching. Pure LLM reasoning.
 *
 * Ported from V3: src/memory/reconciler.py (189 lines)
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { memoryLLMGenerate } from "./memory-llm.js";

const log = createSubsystemLogger("reconciler");

// ─── LLM Prompt ──────────────────────────────────────────────────────────

const RECONCILIATION_PROMPT = `You are a memory reconciliation auditor for an AI system (Ernos).
You are given three sets of retrieved context about the same topic:

1. TIER 5 LESSONS — Universal truths, system axioms, or verified user lessons (ABSOLUTE AUTHORITY).
2. TIER 3 KNOWLEDGE GRAPH FACTS — Structured, curated facts (High Authority).
3. TIER 2 VECTOR MEMORIES — Semantic conversational history (Low Authority).

Your job: Identify cases where lower-tier data (KG or Vector) contradicts or is superseded by higher-tier data (Lessons > KG > Vector).

CONTRADICTION RULES:
1. THE T5 SUPREMACY: If a Vector memory or KG fact contradicts a Tier 5 Lesson, the Lesson is correct.
2. KG OVER VECTOR: If a Vector memory contradicts a KG fact (and no Lesson applies), the KG fact is correct.
3. TEMPORAL UPDATES: Newer KG facts supersede older Vector memories.

WHAT COUNTS AS A CONFLICT:
- A vector/KG says X, but a higher tier says Y.
- Information in a lower tier that has been explicitly negated or evolved in a higher tier.

RESPOND WITH ONE LINE PER FINDING:
- If NO conflicts: CONSISTENT
- For each conflict found: CONFLICT:<tier_type>:<index>|<brief reason in under 15 words>
  (tier_type is "VM" for vector or "KG" for knowledge graph)

Examples:
CONSISTENT
CONFLICT:VM:0|Lesson 4 says user is vegan, VM claims steak preference
CONFLICT:KG:1|T5 Lesson dictates privacy; KG fact reveals PII
CONFLICT:VM:2|KG says Berlin but VM says Amsterdam for same user

Be precise. Only flag genuine contradictions.`;

// ─── Types ───────────────────────────────────────────────────────────────

/** A detected cross-tier disagreement. */
export interface ConflictRecord {
  /** The entity or topic involved */
  entity: string;
  /** The conflicting text from the lower-authority tier */
  targetText: string;
  /** The authoritative text from the higher-authority tier */
  authorityText: string;
  /** Which tier contains the conflict: "KG" or "VM" */
  conflictType: "KG" | "VM";
  /** Brief explanation of the conflict */
  reason: string;
}

/** Output of the reconciliation step. */
export interface ReconciliationResult {
  /** Tier 5 lessons (unchanged) */
  lessons: string[];
  /** Tier 3 KG facts (potentially annotated with [🛑REJECTED]) */
  kgFacts: string[];
  /** Tier 2 vector memories (potentially annotated with [⚠️STALE?]) */
  vectorTexts: string[];
  /** Detected conflicts */
  conflicts: ConflictRecord[];
  /** Summary stats */
  stats: {
    lessons: number;
    kg: number;
    vector: number;
    conflicts: number;
  };
}

// ─── Reconciler ──────────────────────────────────────────────────────────

export class CrossTierReconciler {
  /**
   * Run LLM-powered multi-tier reconciliation.
   *
   * Sends Lessons, KG facts, and Vector memories to the LLM for
   * authority-weighted conflict analysis. Returns annotated results
   * with conflicts tagged.
   */
  public async reconcile(
    lessons: string[] = [],
    kgFacts: string[] = [],
    vectorTexts: string[] = [],
  ): Promise<ReconciliationResult> {
    // Quick exit: nothing to compare
    if ((!lessons.length && !kgFacts.length) || (!kgFacts.length && !vectorTexts.length)) {
      return {
        lessons,
        kgFacts,
        vectorTexts,
        conflicts: [],
        stats: {
          lessons: lessons.length,
          kg: kgFacts.length,
          vector: vectorTexts.length,
          conflicts: 0,
        },
      };
    }

    // Build the structured input for the LLM
    const reconciliationInput = this._buildInput(lessons, kgFacts, vectorTexts);

    let verdictText: string;
    try {
      verdictText = await memoryLLMGenerate(RECONCILIATION_PROMPT, reconciliationInput, {
        temperature: 0.2, // Very low — we want precise, factual analysis
        timeoutMs: 20_000,
      });
    } catch (err: any) {
      log.warn(`LLM call failed: ${err.message || err}`);
      // Graceful degradation: return unmodified results
      return {
        lessons,
        kgFacts,
        vectorTexts,
        conflicts: [],
        stats: {
          lessons: lessons.length,
          kg: kgFacts.length,
          vector: vectorTexts.length,
          conflicts: 0,
        },
      };
    }

    // Parse structured verdicts
    const conflicts = this._parseVerdicts(verdictText, lessons, kgFacts, vectorTexts);

    // Annotate conflicting entries
    const annotatedKg = [...kgFacts];
    const annotatedVectors = [...vectorTexts];

    for (const conflict of conflicts) {
      if (conflict.conflictType === "KG") {
        const idx = kgFacts.indexOf(conflict.targetText);
        if (idx >= 0) {
          annotatedKg[idx] = `[🛑REJECTED] ${annotatedKg[idx]}`;
        }
      } else {
        const idx = vectorTexts.indexOf(conflict.targetText);
        if (idx >= 0) {
          annotatedVectors[idx] = `[⚠️STALE?] ${annotatedVectors[idx]}`;
        }
      }
    }

    log.info(
      `Reconciled: ${conflicts.length} conflicts found across ${kgFacts.length} KG facts and ${vectorTexts.length} vector memories`,
    );

    return {
      lessons,
      kgFacts: annotatedKg,
      vectorTexts: annotatedVectors,
      conflicts,
      stats: {
        lessons: lessons.length,
        kg: kgFacts.length,
        vector: vectorTexts.length,
        conflicts: conflicts.length,
      },
    };
  }

  /**
   * Invalidate stale vector memories that conflict with KG facts.
   * Called as a background cleanup task.
   */
  public async invalidateStaleVectors(
    subject: string,
    object: string,
    reason: string,
  ): Promise<void> {
    log.info(`Invalidating stale vector memories: ${subject} -> ${object}. Reason: ${reason}`);
    // Future: call into vector store to delete/flag matching entries
    // await vectorStore.deleteByMetadata({ subject, object });
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private _buildInput(lessons: string[], kgFacts: string[], vectorTexts: string[]): string {
    const parts: string[] = ["TIER 5 LESSONS (AUTHORITY):"];
    for (let i = 0; i < lessons.length; i++) {
      parts.push(`  LS[${i}]: ${lessons[i]}`);
    }

    parts.push("\nTIER 3 KG FACTS:");
    for (let i = 0; i < kgFacts.length; i++) {
      parts.push(`  KG[${i}]: ${kgFacts[i]}`);
    }

    parts.push("\nTIER 2 VECTOR MEMORIES:");
    for (let i = 0; i < vectorTexts.length; i++) {
      // Truncate very long vector texts to keep prompt manageable
      parts.push(`  VM[${i}]: ${vectorTexts[i].slice(0, 400)}`);
    }

    parts.push("\nAnalyze hierarchy for contradictions. Respond with one line per finding.");
    return parts.join("\n");
  }

  private _parseVerdicts(
    verdictText: string,
    lessons: string[],
    kgFacts: string[],
    vectorTexts: string[],
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const conflictPattern = /CONFLICT:(VM|KG):(\d+)\|(.+)/i;

    for (const line of verdictText.trim().split("\n")) {
      const match = conflictPattern.exec(line.trim());
      if (match) {
        const tier = match[1].toUpperCase() as "VM" | "KG";
        const idx = parseInt(match[2], 10);
        const reason = match[3].trim();

        const targetList = tier === "VM" ? vectorTexts : kgFacts;
        if (idx >= 0 && idx < targetList.length) {
          conflicts.push({
            entity: "",
            targetText: targetList[idx],
            authorityText: lessons[0] || "Hierarchy authority",
            conflictType: tier,
            reason,
          });
        }
      }
    }

    return conflicts;
  }
}
