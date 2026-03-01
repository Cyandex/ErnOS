/**
 * Skill Forge Tool — Lets Ernos create and edit his own skill files.
 *
 * Ported from V3's skill_forge_tool.py. V5 skills are `.md` files with
 * YAML frontmatter stored in the workspace `_agents/skills/` directory.
 *
 * Two tools:
 *   - propose_skill: Write a new skill `.md` file
 *   - edit_skill: Update an existing skill's content
 */

import * as fs from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import { agentBus } from "../agent-bus.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

/** Rate-limit tracker: one proposal per 30 seconds per user. */
const lastProposalTime = new Map<string, number>();
const COOLDOWN_MS = 30_000;

/**
 * Resolve the skills directory for self-authored skills.
 * Uses `_agents/skills/` in the workspace root.
 */
function resolveSkillsDir(): string {
  const workspace = resolveWorkspaceRoot();
  const skillsDir = path.join(workspace, "_agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  return skillsDir;
}

/**
 * Generate a well-formed skill `.md` file from the given parameters.
 */
function buildSkillMarkdown(params: {
  name: string;
  description: string;
  instructions: string;
}): string {
  return [
    "---",
    `description: ${params.description}`,
    "---",
    "",
    params.instructions,
    "",
  ].join("\n");
}

const ProposeSkillSchema = Type.Object({
  name: Type.String({
    description:
      "Skill name in snake_case (e.g. deep_research, weekly_digest). " +
      "Used as the filename: <name>.md",
  }),
  description: Type.String({
    description: "Brief one-line description of what the skill does.",
  }),
  instructions: Type.String({
    description:
      "The full skill instructions in Markdown. Structure as a multi-phase SOP: " +
      "# Skill Name\\n> Output: ...\\n> Tone: ...\\n" +
      "## PHASE 1: ...\\n1. `tool_name` — what to do\\n" +
      "**Checkpoint**: what must be true before Phase 2\\n" +
      "## PHASE 2: ...\\n## QUALITY GATES\\n- [ ] Gate 1",
  }),
});

const EditSkillSchema = Type.Object({
  name: Type.String({
    description: "Name of the existing skill to edit (without .md extension).",
  }),
  description: Type.Optional(
    Type.String({ description: "New description (optional — omit to keep current)." }),
  ),
  instructions: Type.Optional(
    Type.String({ description: "New instructions body (optional — omit to keep current)." }),
  ),
});

export function createSkillForgeTools(opts?: { userId?: string }): AnyAgentTool[] {
  return [
    {
      label: "Propose Skill",
      name: "propose_skill",
      description:
        "Create a new skill (Standard Operating Procedure) as a .md file. " +
        "The skill is immediately available after creation. " +
        "Structure instructions as a multi-phase SOP with numbered tool calls, " +
        "checkpoints between phases, and quality gates at the end.",
      parameters: ProposeSkillSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        const name = readStringParam(params, "name", { required: true });
        const description = readStringParam(params, "description", { required: true });
        const instructions = readStringParam(params, "instructions", { required: true });
        const userId = opts?.userId ?? "unknown";

        // Rate limit check
        const lastTime = lastProposalTime.get(userId) ?? 0;
        if (Date.now() - lastTime < COOLDOWN_MS) {
          return {
            content: [
              {
                type: "text",
                text: "RATE LIMIT: You already proposed a skill recently. Wait 30 seconds.",
              },
            ],
            details: {},
          };
        }

        // Sanitise name to snake_case
        const safeName = name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        if (!safeName) {
          return {
            content: [{ type: "text", text: "Error: Invalid skill name after sanitisation." }],
            details: {},
          };
        }

        const skillsDir = resolveSkillsDir();
        const filePath = path.join(skillsDir, `${safeName}.md`);

        // Duplicate check
        if (fs.existsSync(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: `⚠️ Skill '${safeName}' already exists. Use edit_skill to modify it.`,
              },
            ],
            details: {},
          };
        }

        // Write skill file
        const content = buildSkillMarkdown({ name: safeName, description, instructions });
        try {
          fs.writeFileSync(filePath, content, "utf-8");
        } catch (e) {
          return {
            content: [{ type: "text", text: `Error writing skill file: ${String(e)}` }],
            details: {},
          };
        }

        lastProposalTime.set(userId, Date.now());

        // Emit bus event
        agentBus.publish("skill-forge", "BROADCAST", "skill:created", {
          name: safeName,
          userId,
          filePath,
          timestamp: Date.now(),
        });

        console.log(`[SkillForge] Skill '${safeName}' created at ${filePath}`);

        return {
          content: [
            {
              type: "text",
              text:
                `✅ **Skill '${safeName}' created!**\n` +
                `File: ${filePath}\n` +
                `The skill is available immediately.`,
            },
          ],
          details: { name: safeName, filePath },
        };
      },
    },
    {
      label: "Edit Skill",
      name: "edit_skill",
      description:
        "Edit an existing skill you created. Provide the skill name and " +
        "the fields to update (description and/or instructions). " +
        "Omitted fields remain unchanged.",
      parameters: EditSkillSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        const name = readStringParam(params, "name", { required: true });
        const newDescription = readStringParam(params, "description");
        const newInstructions = readStringParam(params, "instructions");

        if (!newDescription && !newInstructions) {
          return {
            content: [
              {
                type: "text",
                text: "⚠️ No changes provided. Specify description and/or instructions.",
              },
            ],
            details: {},
          };
        }

        const safeName = name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        const skillsDir = resolveSkillsDir();
        const filePath = path.join(skillsDir, `${safeName}.md`);

        if (!fs.existsSync(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Skill '${safeName}' not found. Check the name and try again.`,
              },
            ],
            details: {},
          };
        }

        // Parse existing file
        let existingContent: string;
        try {
          existingContent = fs.readFileSync(filePath, "utf-8");
        } catch (e) {
          return {
            content: [{ type: "text", text: `Error reading skill file: ${String(e)}` }],
            details: {},
          };
        }

        // Extract current frontmatter and body
        let currentDescription = "";
        let currentInstructions = "";
        const fmMatch = existingContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (fmMatch) {
          const fmLines = fmMatch[1].split("\n");
          for (const line of fmLines) {
            const descMatch = line.match(/^description:\s*(.+)$/);
            if (descMatch) {currentDescription = descMatch[1].trim();}
          }
          currentInstructions = fmMatch[2].trim();
        } else {
          currentInstructions = existingContent.trim();
        }

        const finalDescription = newDescription || currentDescription;
        const finalInstructions = newInstructions || currentInstructions;

        const content = buildSkillMarkdown({
          name: safeName,
          description: finalDescription,
          instructions: finalInstructions,
        });

        try {
          fs.writeFileSync(filePath, content, "utf-8");
        } catch (e) {
          return {
            content: [{ type: "text", text: `Error writing skill file: ${String(e)}` }],
            details: {},
          };
        }

        const fieldsUpdated: string[] = [];
        if (newDescription) {fieldsUpdated.push("description");}
        if (newInstructions) {fieldsUpdated.push("instructions");}

        agentBus.publish("skill-forge", "BROADCAST", "skill:edited", {
          name: safeName,
          fieldsUpdated,
          timestamp: Date.now(),
        });

        console.log(`[SkillForge] Skill '${safeName}' edited: ${fieldsUpdated.join(", ")}`);

        return {
          content: [
            {
              type: "text",
              text:
                `✅ **Skill '${safeName}' updated!**\n` +
                `Updated: ${fieldsUpdated.join(", ")}\n` +
                `Changes are live immediately.`,
            },
          ],
          details: { name: safeName, fieldsUpdated },
        };
      },
    },
  ];
}
