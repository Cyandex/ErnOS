/**
 * Semantic Salience Engine — LLM-Powered Importance Scoring
 *
 * Calculates the "importance" of incoming messages/events to drive memory
 * consolidation logic. Replaces keyword heuristics with LLM-based scoring.
 *
 * Used by: MemoryStore.observe() to decide whether to trigger consolidation.
 *
 * Ported from V3: src/memory/salience.py (80 lines)
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { memoryLLMGenerate } from "./memory-llm.js";

const log = createSubsystemLogger("salience");

/** Score threshold above which a message is considered salient for long-term memory. */
const SALIENCE_THRESHOLD = 0.75;

export class SemanticSalienceEngine {
  /**
   * Fast heuristic-based salience scoring (0-10 scale).
   * Used for quick filtering before expensive LLM calls.
   * Kept for backwards compatibility with orchestrator.
   */
  public scoreText(text: string): number {
    let score = 2; // Base score

    const lower = text.toLowerCase();

    // Keywords indicating high emotional or narrative relevance
    if (lower.includes("important") || lower.includes("critical")) score += 3;
    if (lower.includes("remember") || lower.includes("never forget")) score += 4;
    if (lower.includes("love") || lower.includes("hate") || lower.includes("fear")) score += 2;
    if (lower.includes("my name is") || lower.includes("i am")) score += 5;

    // Length heuristics
    if (text.length > 500) score += 2;
    else if (text.length < 20) score -= 1;

    return Math.max(0, Math.min(10, score));
  }

  /**
   * LLM-powered salience evaluation (0.0 to 1.0).
   * More accurate than heuristics but requires an Ollama call.
   *
   * Criteria:
   * - Factual facts/preferences = High (0.8-1.0)
   * - Emotional disclosure = High (0.7-1.0)
   * - Project instructions = High (0.9-1.0)
   * - Chit-chat/Greetings = Low (0.0-0.3)
   * - Short reactions = Low (0.0-0.1)
   */
  public async evaluateSalience(message: string, context: string[] = []): Promise<number> {
    // Fast reject: very short messages are likely reactions
    if (message.length < 5) return 0.1;

    try {
      const response = await memoryLLMGenerate(
        SALIENCE_PROMPT,
        buildSalienceInput(message, context),
        { temperature: 0.1, timeoutMs: 10_000 },
      );

      // Extract score from response
      const match = /(?:^|\s)(0\.\d+|1\.0|[01])(?:\s|$)/m.exec(response);
      if (match) {
        const score = parseFloat(match[1]);
        if (score >= 0 && score <= 1) return score;
      }

      log.debug(`Could not parse salience score from: "${response.slice(0, 100)}"`);
      return 0.5; // Default neutral
    } catch (err: any) {
      log.warn(`LLM salience scoring failed: ${err.message || err}`);
      // Fallback to heuristic
      return this.scoreText(message) / 10;
    }
  }

  /**
   * Compat method for scoring a structured entry (e.g., from working memory).
   */
  public async scoreEntry(entry: { user?: string; bot?: string }): Promise<number> {
    const text = `${entry.user || ""} ${entry.bot || ""}`.trim();
    return this.evaluateSalience(text);
  }

  /**
   * Check if a message exceeds the salience threshold for long-term storage.
   */
  public async isSalient(message: string, context: string[] = []): Promise<boolean> {
    const score = await this.evaluateSalience(message, context);
    return score >= SALIENCE_THRESHOLD;
  }
}

// ─── Prompt & Helpers ───────────────────────────────────────────────────

const SALIENCE_PROMPT = `Rate the long-term memory importance of this message from 0.0 to 1.0.

Criteria:
- Factual facts/preferences = High (0.8-1.0)
- Emotional disclosure = High (0.7-1.0)
- Project instructions = High (0.9-1.0)
- Chit-chat/Greetings = Low (0.0-0.3)
- Short reactions = Low (0.0-0.1)

Return ONLY the number (e.g. 0.85). Nothing else.`;

function buildSalienceInput(message: string, context: string[]): string {
  const parts = [`Message: "${message}"`];
  if (context.length > 0) {
    parts.push(`Context: ${context.slice(-3).join(" | ")}`);
  } else {
    parts.push("Context: None");
  }
  return parts.join("\n");
}

// Backwards compatibility alias
export { SemanticSalienceEngine as SalienceScorer };
