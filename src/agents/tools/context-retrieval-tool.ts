/**
 * Context Retrieval Tool — Looks up artifact provenance and creation context.
 *
 * Allows Ernos to query: "Why did I create this file?" / "What prompt
 * generated this image?" by searching the provenance ledger.
 *
 * Ported from V3's `tools/context_retrieval.py` (2.7K).
 */

import { Type } from "@sinclair/typebox";
import { ProvenanceManager } from "../../security/provenance.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

const ContextRetrievalSchema = Type.Object({
  filename_or_query: Type.String({
    description:
      "The filename (e.g. 'generated_image_123.png') or text snippet from " +
      "the prompt/intention to search for in the provenance ledger.",
  }),
});

export function createContextRetrievalTool(): AnyAgentTool {
  return {
    label: "Check Creation Context",
    name: "check_creation_context",
    description:
      "Retrieve intention and context for a specific file/artifact. " +
      "Searches the provenance ledger for matching filenames, prompts, or intentions.",
    parameters: ContextRetrievalSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "filename_or_query", { required: true });

      try {
        const records = ProvenanceManager.search(query);

        if (!records.length) {
          return {
            content: [{ type: "text", text: `No context found for '${query}'.` }],
            details: {},
          };
        }

        const lines = [`Found ${records.length} matching artifacts:`];

        for (const record of records.slice(-3)) {
          const meta = record.metadata || {};
          lines.push(
            `\n--- Artifact: ${record.filename} ---\n` +
              `Created: ${record.timestamp}\n` +
              `Intention: ${(meta.intention as string) ?? "None recorded"}\n` +
              `Prompt: ${(meta.prompt as string) ?? "Unknown"}\n` +
              `Scope: ${(meta.scope as string) ?? "Unknown"}\n` +
              `Checksum: ${record.checksum.slice(0, 8)}...`,
          );
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: { matchCount: records.length },
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Context Retrieval Error: ${String(e)}` }],
          details: {},
        };
      }
    },
  };
}
