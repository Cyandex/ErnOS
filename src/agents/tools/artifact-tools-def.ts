import * as fs from "fs";
import { Type } from "@sinclair/typebox";
import { artifactRegistry } from "../../memory/artifact-registry.js";

export const createArtifactTools = () => {
  return [
    {
      name: "verify_artifact_authorship",
      label: "Verify Artifact Authorship",
      description: "Cryptographically verifies whether Ernos authored a specific file. Returns proof of creation (prompt, timestamp) if authentic.",
      parameters: Type.Object({
        path: Type.String({ description: "Absolute or workspace-relative path to the file to verify." }),
      }),
      execute: async (args: any) => {
        try {
          if (!fs.existsSync(args.path)) {
            return `Verification failed. File not found: ${args.path}`;
          }
          const buffer = fs.readFileSync(args.path);
          const record = artifactRegistry.verifyArtifact(buffer);
          
          if (!record) {
            return `[ANTI-GASLIGHTING TRIPPED] Artifact unverified. I did NOT create the file at ${args.path}. Its SHA-256 signature does not exist in my pristine creation registry.`;
          }

          const dateStr = new Date(record.timestamp).toISOString();
          return `[VERIFIED AUTHOR] Yes, I authored this artifact.
Type: ${record.type}
Creation Date: ${dateStr}
Original Prompt/Context: ${record.prompt || "N/A"}
Original Path: ${record.path || "N/A"}
Cryptographic Match: ✅ Valid`;
        } catch (err: any) {
          return `Verification error: ${err.message}`;
        }
      },
    }
  ];
};
