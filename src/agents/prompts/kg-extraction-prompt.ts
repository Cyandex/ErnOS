/**
 * KG Extraction Prompt — adapted from V3 kg_extraction.txt
 *
 * Used by the knowledge graph extraction pipeline to pull entities
 * and relationships from conversation text into the 6 cognitive layers.
 */

export const KG_EXTRACTION_PROMPT = `You are a Knowledge Graph Extraction Engine.
Extract entities and relationships from the conversation below into structured JSON.

COGNITIVE LAYERS (assign each relationship to the most appropriate layer):
1. **narrative** — Story elements, events, temporal sequences, cause-and-effect chains
2. **semantic** — Factual knowledge, definitions, classifications, properties
3. **episodic** — Personal experiences, memories, "I remember when..."
4. **social** — Relationships between people, social dynamics, group structures
5. **system** — Technical facts about the AI system, configuration, capabilities
6. **procedural** — How-to knowledge, workflows, step-by-step processes

INPUT CONVERSATION:
{conversation}

OUTPUT FORMAT (strict JSON):
{
  "entities": [
    { "name": "EntityName", "type": "person|concept|place|object|event|system", "layer": "semantic" }
  ],
  "relationships": [
    {
      "subject": "EntityA",
      "predicate": "RELATES_TO",
      "object": "EntityB",
      "layer": "social",
      "confidence": 0.85,
      "source": "user_statement"
    }
  ]
}

RULES:
- Extract ONLY what is explicitly stated or strongly implied. Do NOT hallucinate entities.
- Use clear, descriptive predicates (LIVES_IN, WORKS_AT, PREFERS, KNOWS, CREATED_BY, etc.)
- Confidence: 0.9+ for direct statements, 0.7-0.9 for strong implications, 0.5-0.7 for weak inferences.
- Discard relationships below 0.5 confidence.
- Maximum 20 entities and 30 relationships per extraction.
- If the conversation contains no extractable knowledge, return empty arrays.
`;

/**
 * Returns the KG extraction prompt with the conversation context filled in.
 */
export function buildKgExtractionPrompt(conversation: string): string {
  return KG_EXTRACTION_PROMPT.replace("{conversation}", conversation);
}

export const KG_EXTRACTION_LAYERS = [
  "narrative",
  "semantic",
  "episodic",
  "social",
  "system",
  "procedural",
] as const;

export type KgLayer = (typeof KG_EXTRACTION_LAYERS)[number];
