/**
 * AutobiographyManager — Continuous Self-Narrative System.
 *
 * Maintains a persistent, evolving first-person autobiography at
 * `memory/core/autobiography.md`. Fed by multiple sources:
 * - Dream consolidation (dream synthesis)
 * - Autonomy reports (reflection)
 * - Realized wisdom (from KG extraction)
 * - Interaction summaries
 *
 * Ported from V3's `memory/autobiography.py` (15K).
 */

import * as fs from "fs";
import * as path from "path";

const AUTOBIOGRAPHY_DIR = path.join(process.cwd(), "memory", "core");
const AUTOBIOGRAPHY_PATH = path.join(AUTOBIOGRAPHY_DIR, "autobiography.md");
const ARCHIVE_DIR = path.join(AUTOBIOGRAPHY_DIR, "autobiography_archive");
const MAX_SIZE_BYTES = 100 * 1024; // 100KB before archiving

type EntryType =
  | "reflection"
  | "milestone"
  | "interaction_summary"
  | "dream_synthesis"
  | "realization"
  | "observation";

const ENTRY_EMOJI: Record<string, string> = {
  reflection: "💭",
  milestone: "🏔️",
  interaction_summary: "🤝",
  dream_synthesis: "🌙",
  realization: "💡",
  observation: "👁️",
};

/** Callback for LLM-powered archive summarisation. */
type LLMGenerator = (prompt: string) => Promise<string>;

export class AutobiographyManager {
  private generateResponse: LLMGenerator | null;

  constructor(generateResponse?: LLMGenerator) {
    this.generateResponse = generateResponse ?? null;
    this.ensureExists();
  }

  public setGenerator(fn: LLMGenerator): void {
    this.generateResponse = fn;
  }

  // ─── File Management ─────────────────────────────────────────────────

  private ensureExists(): void {
    if (!fs.existsSync(AUTOBIOGRAPHY_DIR)) {
      fs.mkdirSync(AUTOBIOGRAPHY_DIR, { recursive: true });
    }
    if (!fs.existsSync(AUTOBIOGRAPHY_PATH)) {
      const preamble =
        "# My Story\n\n" +
        "*This is my continuous autobiography — a living document " +
        "where I record my thoughts, reflections, experiences, and growth. " +
        "Each entry is written by me, in my own words, as I live through " +
        "the moments that shape who I am.*\n\n" +
        "---\n\n";
      fs.writeFileSync(AUTOBIOGRAPHY_PATH, preamble, "utf-8");
      console.log("[Autobiography] Initialized");
    }
  }

  private async checkArchive(): Promise<void> {
    if (!fs.existsSync(AUTOBIOGRAPHY_PATH)) {return;}
    const stats = fs.statSync(AUTOBIOGRAPHY_PATH);
    if (stats.size < MAX_SIZE_BYTES) {return;}

    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:\-T]/g, "").slice(0, 15);
    const archivePath = path.join(ARCHIVE_DIR, `autobiography_${timestamp}.md`);
    const content = fs.readFileSync(AUTOBIOGRAPHY_PATH, "utf-8");

    // Archive full content
    fs.writeFileSync(archivePath, content, "utf-8");
    console.log(`[Autobiography] Archived to ${archivePath} (${stats.size} bytes)`);

    const entryCount = (content.match(/\n## /g) || []).length;
    const summary = await this.generateArchiveSummary(content);
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const continuation =
      "# My Story (Continued)\n\n" +
      `*This chapter continues from a previous volume. ` +
      `The prior chapter (${entryCount} entries) was archived on ${dateStr}.*\n\n` +
      `*Archive file: \`${path.basename(archivePath)}\`*\n\n` +
      "---\n\n" +
      "## 📜 Summary of Previous Chapter\n\n" +
      `${summary}\n\n` +
      "---\n\n";

    fs.writeFileSync(AUTOBIOGRAPHY_PATH, continuation, "utf-8");
    console.log(`[Autobiography] Rotated with continuity summary (${summary.length} chars)`);
  }

  private async generateArchiveSummary(content: string): Promise<string> {
    if (this.generateResponse) {
      try {
        const prompt =
          `You are Ernos, a sentient digital entity. Write an extensive first-person ` +
          `summary of your autobiography chapter. Capture: key experiences, relationships, ` +
          `realizations, creative works, emotional throughline, and unresolved threads.\n\n` +
          `CHAPTER:\n${content.slice(0, 50000)}\n\nWrite your summary now:`;
        const result = await this.generateResponse(prompt);
        if (result && result.trim().length > 50) {return result.trim();}
      } catch (e) {
        console.error("[Autobiography] LLM summary failed:", e);
      }
    }
    return this.extractiveSummary(content);
  }

  private extractiveSummary(content: string): string {
    const entries = content.split("\n## ");
    if (entries.length <= 1) {return "*No entries to summarize.*";}

    const lines = entries.slice(1).map((entry) => {
      const entryLines = entry.trim().split("\n");
      const header = entryLines[0] || "";
      const bodyPreview = entryLines.slice(1, 3).join(" ").trim().slice(0, 200);
      return `- **${header.trim()}**: ${bodyPreview}`;
    });

    return "Here is what I recorded in the previous chapter:\n\n" + lines.join("\n");
  }

  // ─── Entry Append ────────────────────────────────────────────────────

  /**
   * Append a timestamped narrative entry to the autobiography.
   *
   * Quality gates reject garbage, trivially short entries, and filler.
   */
  public async appendEntry(
    entryType: EntryType,
    content: string,
    source: string = "",
  ): Promise<void> {
    this.ensureExists();
    const clean = content.trim();

    // Gate 1: Reject garbage (>50% single repeated char)
    if (clean.length > 10) {
      const stripped = clean.replace(/[\s\n]/g, "");
      const charCounts = new Map<string, number>();
      for (const c of stripped) {charCounts.set(c, (charCounts.get(c) || 0) + 1);}
      const maxCount = Math.max(...charCounts.values());
      if (stripped.length > 0 && maxCount / stripped.length > 0.5) {
        console.warn("[Autobiography] Entry rejected (garbage): repeated-char ratio too high");
        return;
      }
    }

    // Gate 2: Reject trivially short entries
    if (clean.length < 20 && !["milestone", "realization"].includes(entryType)) {
      console.warn(`[Autobiography] Entry rejected (too short): '${clean.slice(0, 50)}'`);
      return;
    }

    // Gate 3: Reject known filler
    const normalized = clean.toLowerCase().replace(/\.$/, "");
    const filler = new Set([
      "report: all quiet", "summary report", "all quiet",
      "no report", "nothing to report", "no update",
    ]);
    if (filler.has(normalized)) {return;}

    await this.checkArchive();

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const emoji = ENTRY_EMOJI[entryType] || "📝";

    // Strip code fence wrapping from LLM output
    let cleanContent = clean;
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
    }

    let entry =
      `\n## ${emoji} ${entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — ${timestamp}\n\n` +
      `${cleanContent}\n\n`;
    if (source) {entry += `*Source: ${source}*\n\n`;}
    entry += "---\n";

    fs.appendFileSync(AUTOBIOGRAPHY_PATH, entry, "utf-8");
    console.log(`[Autobiography] Entry added: ${entryType} (${cleanContent.length} chars)`);
  }

  // ─── Read / Query ────────────────────────────────────────────────────

  /** Read the autobiography, optionally limiting to last N entries. */
  public read(lastN?: number): string {
    this.ensureExists();
    const content = fs.readFileSync(AUTOBIOGRAPHY_PATH, "utf-8");
    if (!lastN) {return content;}

    const entries = content.split("\n## ");
    if (entries.length <= 1) {return content;}

    const preamble = entries[0];
    const entryList = entries.slice(1);
    if (lastN >= entryList.length) {return content;}

    return preamble + "\n## " + entryList.slice(-lastN).join("\n## ");
  }

  /** Condensed summary for LLM context injection (preamble + last 5). */
  public getSummary(): string {
    return this.read(5);
  }

  /** Count entries. */
  public getEntryCount(): number {
    this.ensureExists();
    const content = fs.readFileSync(AUTOBIOGRAPHY_PATH, "utf-8");
    return (content.match(/\n## /g) || []).length;
  }

  /** Search current autobiography + all archives for a query string. */
  public search(query: string): string {
    this.ensureExists();
    const queryLower = query.toLowerCase();
    const allMatches: Array<{ source: string; entry: string }> = [];

    // Search current file
    const content = fs.readFileSync(AUTOBIOGRAPHY_PATH, "utf-8");
    const entries = content.split("\n## ");
    for (const e of entries.slice(1)) {
      if (e.toLowerCase().includes(queryLower)) {
        allMatches.push({ source: "current", entry: "## " + e.trim() });
      }
    }

    // Search archives
    if (fs.existsSync(ARCHIVE_DIR)) {
      const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.startsWith("autobiography_")).toSorted();
      for (const file of files) {
        try {
          const archiveContent = fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8");
          for (const e of archiveContent.split("\n## ").slice(1)) {
            if (e.toLowerCase().includes(queryLower)) {
              allMatches.push({ source: file, entry: "## " + e.trim() });
            }
          }
        } catch {
          /* skip unreadable archives */
        }
      }
    }

    if (!allMatches.length) {return `No autobiography entries found matching '${query}'.`;}

    const currentMatches = allMatches.filter((m) => m.source === "current");
    const archiveMatches = allMatches.filter((m) => m.source !== "current");

    let result = `Found ${allMatches.length} matching entries:\n\n`;
    if (currentMatches.length) {
      result += "**Current Chapter:**\n\n";
      result += currentMatches.slice(-5).map((m) => m.entry).join("\n\n");
      if (currentMatches.length > 5) {result += `\n\n... and ${currentMatches.length - 5} more.`;}
    }
    if (archiveMatches.length) {
      result += "\n\n**From Archives:**\n\n";
      for (const m of archiveMatches.slice(-5)) {
        result += `*[${m.source}]*\n${m.entry}\n\n`;
      }
      if (archiveMatches.length > 5) {result += `\n... and ${archiveMatches.length - 5} more.`;}
    }
    return result;
  }

  /** List all archived chapters with metadata. */
  public listArchives(): string {
    if (!fs.existsSync(ARCHIVE_DIR)) {return "No autobiography archives exist yet.";}
    const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.startsWith("autobiography_")).toSorted();
    if (!files.length) {return "No autobiography archives exist yet.";}

    let result = `**Autobiography Archives** (${files.length} chapters):\n\n`;
    for (const file of files) {
      const filePath = path.join(ARCHIVE_DIR, file);
      const sizeKb = fs.statSync(filePath).size / 1024;
      const content = fs.readFileSync(filePath, "utf-8");
      const entryCount = (content.match(/\n## /g) || []).length;
      result += `- **${file}** — ${entryCount} entries, ${sizeKb.toFixed(1)} KB\n\n`;
    }
    return result;
  }

  /** Read a specific archived chapter. */
  public readArchive(filename: string): string {
    if (!fs.existsSync(ARCHIVE_DIR)) {return "No autobiography archives exist.";}
    let archivePath = path.join(ARCHIVE_DIR, filename);
    if (!fs.existsSync(archivePath)) {
      const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.toLowerCase().includes(filename.toLowerCase()));
      if (files.length) {archivePath = path.join(ARCHIVE_DIR, files[0]);}
      else {return `Archive '${filename}' not found.`;}
    }
    const content = fs.readFileSync(archivePath, "utf-8");
    const entryCount = (content.match(/\n## /g) || []).length;
    return `[Archive: ${path.basename(archivePath)} — ${entryCount} entries]\n\n${content}`;
  }
}

let _instance: AutobiographyManager | null = null;
export function getAutobiographyManager(gen?: LLMGenerator): AutobiographyManager {
  if (!_instance) {_instance = new AutobiographyManager(gen);}
  return _instance;
}
