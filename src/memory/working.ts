import * as fs from "fs";
import * as path from "path";
import { Turn } from "./context.js";
import { KnowledgeGraph } from "./knowledge-graph/graph.js";
// Note: To be wired up with a real LLM endpoint during orchestrator phase
// import { llm } from '../some-llm-service';

export class WorkingMemory {
  private maxTurns: number;
  private persistPath: string;
  private buffer: Turn[];

  constructor(
    maxTurns: number = 500,
    persistPath: string = path.join(process.cwd(), "memory", "core", "working_memory.jsonl"),
  ) {
    this.maxTurns = maxTurns;
    this.persistPath = persistPath;
    this.buffer = [];
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const lines = fs.readFileSync(this.persistPath, "utf-8").split("\\n").filter(Boolean);
        this.buffer = lines.map((l) => JSON.parse(l) as Turn);
      }
    } catch (e) {
      console.warn(`Failed to load working memory from disk: ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const lines = this.buffer.map((t) => JSON.stringify(t)).join("\\n") + "\\n";
      fs.writeFileSync(this.persistPath, lines, "utf-8");
    } catch (e) {
      console.error(`Failed to persist working memory: ${e}`);
    }
  }

  public async addTurn(
    userMsg: string,
    botMsg: string,
    userId: string,
    userName: string = "Unknown",
    scope: string = "PUBLIC",
    persona?: string,
    channelId?: number,
  ) {
    const turn: Turn = {
      userId,
      userName,
      userMessage: userMsg,
      botMessage: botMsg,
      timestamp: Date.now(),
      metadata: {},
      scope,
      persona,
      channelId,
    };

    this.buffer.push(turn);

    if (this.buffer.length > this.maxTurns) {
      await this.consolidate();
    } else {
      this.saveToDisk();
    }
  }

  public async consolidate() {
    // 1. Take the oldest turns that exceed max
    const overflow = this.buffer.length - this.maxTurns;
    const toConsolidate = this.buffer.splice(0, overflow + 50); // Take overflow plus a chunk so we don't consolidate every turn

    // 2. Here we would call the LLM to summarize `toConsolidate` and extract facts
    // const summary = await llm.summarizeMatches(toConsolidate);
    // const facts = await llm.extractFacts(summary);

    // 3. For now, just remove them and log
    console.log(
      `[WorkingMemory] Consolidated ${toConsolidate.length} turns to free up buffer space.`,
    );

    // 4. Archive raw turns to long-term storage
    this.archive(toConsolidate);

    // 5. Save remaining active buffer
    this.saveToDisk();
  }

  private archive(turns: Turn[]) {
    try {
      const archivePath = path.join(
        process.cwd(),
        "memory",
        "core",
        "archive_working_memory.jsonl",
      );
      const dir = path.dirname(archivePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const lines = turns.map((t) => JSON.stringify(t)).join("\\n") + "\\n";
      fs.appendFileSync(archivePath, lines, "utf-8");
    } catch (e) {
      console.error(`Failed to archive working memory: ${e}`);
    }
  }

  public getContextString(
    targetScope: string = "PUBLIC",
    userId?: string,
    channelId?: number,
  ): string {
    let relevant = this.buffer;

    // Filter by Scope
    if (targetScope === "PRIVATE" || targetScope === "CORE_PRIVATE") {
      if (!userId) {
        console.warn(
          "WorkingMemory: Requested PRIVATE scope but no userId provided. Restricting to PUBLIC.",
        );
        relevant = relevant.filter((t) => t.scope === "PUBLIC");
      } else {
        relevant = relevant.filter(
          (t) => t.scope === "PUBLIC" || (t.scope === targetScope && t.userId === userId),
        );
      }
    } else {
      // Clean PUBLIC scope request
      relevant = relevant.filter((t) => t.scope === "PUBLIC");
    }

    // Filter by Channel for public discussions
    if (channelId !== undefined) {
      relevant = relevant.filter((t) => t.channelId === undefined || t.channelId === channelId);
    }

    if (relevant.length === 0) return "No working memory context.";

    return relevant
      .map(
        (t) =>
          `[${new Date(t.timestamp).toISOString()}] ${t.userName}: ${t.userMessage}\\nBot: ${t.botMessage}`,
      )
      .join("\\n\\n");
  }
}
