export interface Turn {
  userId: string;
  userName: string;
  userMessage: string;
  botMessage: string;
  timestamp: number;
  metadata: Record<string, any>;
  scope: string; // e.g., "PUBLIC", "PRIVATE", "CORE_PRIVATE"
  persona?: string;
  channelId?: number;
}

export interface ContextObject {
  // Tier 1: Working Memory
  workingMemory: string;

  // Tier 2: Semantic / Vector Memory
  relatedMemories: string[];

  // Tier 3: Knowledge Graph
  knowledgeGraph: string[];

  // Tier 4: Lessons / Facts
  lessons: string[];

  // Tier 3.5: Epistemic Context
  epistemicContext?: any;

  // Tier 5: Tape Machine
  tapeView?: string;

  // Privacy Isolation
  scope: string;
}

export type MemoryScope = "PUBLIC" | "PRIVATE" | "CORE_PRIVATE";
