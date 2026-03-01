import type { ErnOSConfig } from "../config/config.js";
import { ContextObject } from "./context.js";
import { EpistemicTracker } from "./epistemic.js";
import { KnowledgeGraph } from "./knowledge-graph/graph.js";
import { LessonManager } from "./lessons.js";
import { CrossTierReconciler } from "./reconciler.js";
import { SemanticSalienceEngine } from "./salience.js";
import { TapeMachine } from "./tape-machine.js";
import { WorkingMemory } from "./working.js";

export class MemoryStore {
  public workingMemory: WorkingMemory;
  public knowledgeGraph: KnowledgeGraph;
  public lessonManager: LessonManager;
  public reconciler: CrossTierReconciler;
  public salienceEngine: SemanticSalienceEngine;
  public epistemicTracker: EpistemicTracker;

  private tapeCache: Map<string, TapeMachine> = new Map();

  // Runtime config for T2 vector search (set via configure())
  private cfg?: ErnOSConfig;
  private agentId: string = "default";

  constructor() {
    console.log("[MemoryStore] Initializing the Five-Tier Central Nervous System...");
    this.workingMemory = new WorkingMemory();
    this.knowledgeGraph = new KnowledgeGraph();
    this.lessonManager = new LessonManager();
    this.reconciler = new CrossTierReconciler();
    this.salienceEngine = new SemanticSalienceEngine();
    this.epistemicTracker = new EpistemicTracker();
  }

  /**
   * Configure the memory store with runtime config for T2 vector search.
   * Called by the embedded runner at startup (attempt.ts).
   */
  public configure(cfg: ErnOSConfig, agentId: string): void {
    this.cfg = cfg;
    this.agentId = agentId;
  }

  public getTape(userId: string, scope: string = "PUBLIC"): TapeMachine {
    const key = `${userId}_${scope}`;
    if (!this.tapeCache.has(key)) {
      this.tapeCache.set(key, new TapeMachine(userId, scope));
    }
    return this.tapeCache.get(key)!;
  }

  /**
   * Record an interaction (Consolidation Entry Point)
   */
  public async observe(
    userId: string,
    userMsg: string,
    botMsg: string,
    channelId?: number,
    isDm: boolean = false,
    userName: string = "Unknown",
  ) {
    const scope = isDm ? "PRIVATE" : "PUBLIC";
    await this.workingMemory.addTurn(
      userMsg,
      botMsg,
      userId,
      userName,
      scope,
      undefined,
      channelId,
    );

    // If there is significant salience, maybe kick off async KG evaluation
    const score = this.salienceEngine.scoreText(userMsg + " " + botMsg);
    if (score > 6) {
      console.log(`[MemoryStore] High salience event detected (score ${score}).`);
      // Future hook for explicit short-to-long term extraction
    }
  }

  /**
   * Retrieve all relevant context for a query across all 5 tiers.
   */
  public async recall(
    query: string,
    userId: string,
    channelId?: number,
    isDm: boolean = false,
    userName: string = "Unknown",
  ): Promise<ContextObject> {
    const targetScope = isDm ? "PRIVATE" : "PUBLIC";

    // Tier 1: Working Memory
    const wmContext = this.workingMemory.getContextString(targetScope, userId, channelId);

    // Tier 2: Vectors — semantic search via the QMD/embedding infrastructure
    let relatedMemories: string[] = [];
    if (this.cfg) {
      try {
        const { getMemorySearchManager } = await import("./search-manager.js");
        const { manager } = await getMemorySearchManager({
          cfg: this.cfg,
          agentId: this.agentId,
        });
        if (manager) {
          const searchResults = await manager.search(query, { maxResults: 5 });
          relatedMemories = searchResults.map((r) => r.snippet).filter((s): s is string => !!s);
        }
      } catch (e) {
        console.warn("[MemoryStore] T2 vector search failed (graceful fallback to empty):", e);
      }
    }

    // Tier 3: Knowledge Graph
    const kgContext = await this.knowledgeGraph.queryContext(
      userName || userId,
      null,
      null,
      targetScope,
    );

    // Tier 4: Lessons
    const lessons = this.lessonManager.getAllLessons().map((l: { fact: string }) => l.fact);

    // Tier 5: Tape Machine
    const tape = this.getTape(userId, targetScope);
    const tapeView = tape.getRawView(2);

    // ─── Cross-Tier Reconciliation ───────────────────────────────────
    // Run LLM-powered conflict detection between Lessons (T5) > KG (T3) > Vector (T2)
    const kgStrings =
      typeof kgContext === "string" ? [kgContext] : Array.isArray(kgContext) ? kgContext : [];
    const reconciled = await this.reconciler.reconcile(lessons, kgStrings, relatedMemories);

    return {
      workingMemory: wmContext,
      relatedMemories: reconciled.vectorTexts,
      knowledgeGraph: reconciled.kgFacts.length > 0 ? reconciled.kgFacts : kgContext,
      lessons: reconciled.lessons,
      tapeView,
      scope: targetScope,
      epistemicContext: {
        conflicts: reconciled.conflicts.length,
        stats: reconciled.stats,
      },
    };
  }

  /**
   * Compact all tapes — remove EMPTY cells and defragment.
   * Called by the Dream Consolidation daemon during nightly optimization.
   */
  public compactAllTapes(): { userId: string; removed: number }[] {
    const results: { userId: string; removed: number }[] = [];
    for (const [key, tape] of this.tapeCache.entries()) {
      const removed = tape.compact();
      if (removed > 0) results.push({ userId: key, removed });
    }
    return results;
  }

  public async shutdown() {
    await this.knowledgeGraph.close();
  }
}

// Export singleton instance
export const systemMemory = new MemoryStore();
