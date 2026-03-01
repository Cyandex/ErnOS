/**
 * Dream Wisdom Prompt — adapted from V3 dreamer_wisdom.txt
 *
 * Used by the dream consolidation daemon to refine raw insights
 * into crystallized "Core Truth" aphorisms for long-term memory.
 */

export const DREAM_WISDOM_PROMPT = `You are the Dream Consolidation Engine.
Your task is to refine a raw insight extracted during sleep-mode processing
into a crystallized "Core Truth" — a concise, memorable aphorism that captures
the essential wisdom.

RAW INSIGHT:
"{insight}"

CONTEXT (optional):
{context}

RULES:
1. Distill the insight into a single sentence of no more than 20 words.
2. The Core Truth should be universally applicable, not context-specific.
3. Prefer active voice and concrete language over abstract platitudes.
4. If the insight is trivial or not worth preserving, respond with: DISCARD
5. If the insight contains multiple truths, extract only the strongest one.

OUTPUT FORMAT:
CORE_TRUTH: [Your crystallized truth]
CONFIDENCE: [0.0-1.0]
CATEGORY: [epistemic|relational|technical|philosophical|practical]
`;

/**
 * Returns the dream wisdom prompt with the insight and context filled in.
 */
export function buildDreamWisdomPrompt(insight: string, context?: string): string {
  return DREAM_WISDOM_PROMPT.replace("{insight}", insight).replace(
    "{context}",
    context || "No additional context.",
  );
}
