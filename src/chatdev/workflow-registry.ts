/**
 * ChatDev Workflow Registry
 *
 * Scans ChatDev's yaml_instance/ directory for available workflows
 * and presents them as selectable modes for ErnOS users.
 */

import fs from "node:fs";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("chatdev-registry");

// ─── Types ─────────────────────────────────────────────────────────────

export interface WorkflowInfo {
  /** YAML filename (e.g., "ChatDev_v1.yaml") */
  filename: string;
  /** Human-readable display name */
  displayName: string;
  /** Workflow description from YAML */
  description: string;
  /** Category (inferred from filename) */
  category: "software" | "research" | "creative" | "data" | "demo" | "custom";
  /** Whether this is a demo workflow */
  isDemo: boolean;
  /** Full file path */
  filePath: string;
}

// ─── Category Mapping ──────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: WorkflowInfo["category"];
}> = [
  { pattern: /chatdev|gamedev/i, category: "software" },
  { pattern: /research/i, category: "research" },
  { pattern: /blender|3d|teach|video/i, category: "creative" },
  { pattern: /data_vis|visualization/i, category: "data" },
  { pattern: /^demo_/i, category: "demo" },
];

// ─── Registry ──────────────────────────────────────────────────────────

export class WorkflowRegistry {
  private chatdevPath: string;
  private workflows: Map<string, WorkflowInfo> = new Map();
  private lastScanAt = 0;

  constructor(chatdevPath: string) {
    this.chatdevPath = chatdevPath;
  }

  /**
   * Scan yaml_instance/ for workflows.
   * Results are cached for 60 seconds.
   */
  scan(): WorkflowInfo[] {
    const now = Date.now();
    if (this.workflows.size > 0 && now - this.lastScanAt < 60000) {
      return [...this.workflows.values()];
    }

    const yamlDir = path.join(this.chatdevPath, "yaml_instance");
    if (!fs.existsSync(yamlDir)) {
      log.warn(`yaml_instance directory not found: ${yamlDir}`);
      return [];
    }

    this.workflows.clear();
    try {
      const files = fs
        .readdirSync(yamlDir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

      for (const file of files) {
        const filePath = path.join(yamlDir, file);
        const info = this.parseWorkflowFile(file, filePath);
        if (info) {
          this.workflows.set(file, info);
        }
      }
    } catch (err) {
      log.warn(`Failed to scan workflows: ${err}`);
    }

    this.lastScanAt = now;
    log.info(`Scanned ${this.workflows.size} workflows`);
    return [...this.workflows.values()];
  }

  /**
   * Get a specific workflow by filename.
   */
  get(filename: string): WorkflowInfo | undefined {
    if (this.workflows.size === 0) {
      this.scan();
    }
    return this.workflows.get(filename);
  }

  /**
   * List workflows filtered by category.
   */
  listByCategory(category: WorkflowInfo["category"]): WorkflowInfo[] {
    return this.scan().filter((w) => w.category === category);
  }

  /**
   * Format workflows as a user-facing list.
   */
  formatList(): string {
    const workflows = this.scan();
    if (workflows.length === 0) {
      return "No workflows available.";
    }

    const grouped = new Map<string, WorkflowInfo[]>();
    for (const wf of workflows) {
      const list = grouped.get(wf.category) ?? [];
      list.push(wf);
      grouped.set(wf.category, list);
    }

    const sections: string[] = ["**Available Workflows:**"];
    const categoryLabels: Record<string, string> = {
      software: "🖥️ Software Development",
      research: "🔬 Deep Research",
      creative: "🎨 Creative / 3D",
      data: "📊 Data Visualization",
      demo: "📋 Demos",
      custom: "⚙️ Custom",
    };

    for (const [cat, items] of grouped.entries()) {
      sections.push(`\n${categoryLabels[cat] ?? cat}`);
      for (const item of items) {
        sections.push(`  • \`${item.filename}\` — ${item.description || item.displayName}`);
      }
    }

    return sections.join("\n");
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private parseWorkflowFile(filename: string, filePath: string): WorkflowInfo | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // Extract description from YAML (lightweight parsing — no YAML lib needed)
      let description = "";
      const descMatch = content.match(/^\s*description:\s*(.+)$/m);
      if (descMatch) {
        description = descMatch[1].trim().replace(/^['"]|['"]$/g, "");
      }

      // Infer display name from filename
      const displayName = filename
        .replace(/\.ya?ml$/, "")
        .replace(/_/g, " ")
        .replace(/\bv(\d)/g, " v$1")
        .trim();

      // Categorize
      const isDemo = filename.startsWith("demo_");
      let category: WorkflowInfo["category"] = "custom";
      for (const { pattern, category: cat } of CATEGORY_PATTERNS) {
        if (pattern.test(filename)) {
          category = cat;
          break;
        }
      }

      return {
        filename,
        displayName,
        description,
        category,
        isDemo,
        filePath,
      };
    } catch {
      return null;
    }
  }
}
