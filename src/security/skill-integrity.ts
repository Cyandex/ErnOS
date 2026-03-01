import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { hasErrnoCode } from "../infra/errors.js";

/**
 * Skill integrity verification via SHA-256 manifest.
 *
 * On install, compute a SHA-256 hash of every file in the skill directory
 * and store the manifest. On load, re-verify. If any file has been tampered
 * with, refuse to load and warn the user.
 *
 * @see Security Report: Malicious Skills Supply Chain
 */

export const MANIFEST_FILENAME = "skill-integrity.json";

export type IntegrityManifest = {
  version: 1;
  createdAt: string;
  hashes: Record<string, string>; // relative path → "sha256:<hex>"
};

export type VerifyResult = {
  valid: boolean;
  tamperedFiles: string[];
  missingFiles: string[];
  newFiles: string[];
};

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

// ---------------------------------------------------------------------------
// Collect files
// ---------------------------------------------------------------------------

async function collectFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const stack: string[] = [dirPath];

  while (stack.length > 0) {
    const currentDir = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      if (hasErrnoCode(err, "ENOENT")) {
        continue;
      }
      throw err;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      if (entry.name === MANIFEST_FILENAME) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute an integrity manifest for a skill directory.
 */
export async function computeManifest(skillDir: string): Promise<IntegrityManifest> {
  const files = await collectFiles(skillDir);
  const hashes: Record<string, string> = {};

  for (const file of files) {
    const relativePath = path.relative(skillDir, file);
    hashes[relativePath] = await hashFile(file);
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    hashes,
  };
}

/**
 * Write the integrity manifest to disk.
 */
export async function writeManifest(skillDir: string, manifest: IntegrityManifest): Promise<void> {
  const manifestPath = path.join(skillDir, MANIFEST_FILENAME);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Read an existing integrity manifest from disk.
 * Returns null if the manifest does not exist.
 */
export async function readManifest(skillDir: string): Promise<IntegrityManifest | null> {
  const manifestPath = path.join(skillDir, MANIFEST_FILENAME);
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(content) as IntegrityManifest;
  } catch (err) {
    if (hasErrnoCode(err, "ENOENT")) {
      return null;
    }
    throw err;
  }
}

/**
 * Verify a skill directory against its integrity manifest.
 */
export async function verifyManifest(
  skillDir: string,
  manifest: IntegrityManifest,
): Promise<VerifyResult> {
  const tamperedFiles: string[] = [];
  const missingFiles: string[] = [];
  const newFiles: string[] = [];

  const currentFiles = await collectFiles(skillDir);
  const currentRelatives = new Set(currentFiles.map((f) => path.relative(skillDir, f)));
  const manifestRelatives = new Set(Object.keys(manifest.hashes));

  // Check for tampered or missing files.
  for (const [relativePath, expectedHash] of Object.entries(manifest.hashes)) {
    const fullPath = path.join(skillDir, relativePath);
    try {
      const actualHash = await hashFile(fullPath);
      if (actualHash !== expectedHash) {
        tamperedFiles.push(relativePath);
      }
    } catch (err) {
      if (hasErrnoCode(err, "ENOENT")) {
        missingFiles.push(relativePath);
      } else {
        throw err;
      }
    }
  }

  // Check for new files not in the manifest.
  for (const relativePath of currentRelatives) {
    if (!manifestRelatives.has(relativePath)) {
      newFiles.push(relativePath);
    }
  }

  return {
    valid: tamperedFiles.length === 0 && missingFiles.length === 0 && newFiles.length === 0,
    tamperedFiles,
    missingFiles,
    newFiles,
  };
}
