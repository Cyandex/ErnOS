/**
 * Cognitive Layers of the Knowledge Graph.
 * 6 core built-in layers. Custom layers can be added dynamically.
 */
export enum GraphLayer {
  NARRATIVE = "narrative", // Default text/memory layer
  SEMANTIC = "semantic", // Definitions, facts, concepts
  EPISODIC = "episodic", // Events, timeline, "I was there"
  SOCIAL = "social", // People, relationships, trust
  SYSTEM = "system", // Core system metadata
  PROCEDURAL = "procedural", // Skills, planning, RL
}

export const BUILTIN_LAYERS = new Set<string>(Object.values(GraphLayer));

export interface LayerMeta {
  description: string;
  parent?: string;
  created: string;
}
