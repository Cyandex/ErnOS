/**
 * ProvenanceManager — Cryptographic Anti-Gaslighting Ledger.
 *
 * Maintains an append-only JSONL ledger of all generated artifacts with
 * HMAC-SHA256 signatures. Provides verification and lookup capabilities
 * so Ernos can always prove what it created and when.
 *
 * Ported from V3's `security/provenance.py` (7.1K).
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "memory", "core");
const SALT_FILE = path.join(DATA_DIR, "shard_salt.secret");
const LEDGER_FILE = path.join(DATA_DIR, "provenance_ledger.jsonl");

export interface ProvenanceRecord {
  timestamp: string;
  filePath: string;
  filename: string;
  type: string;
  checksum: string;
  metadata: Record<string, unknown>;
}

let saltCache: string | null = null;

export class ProvenanceManager {
  /**
   * Get or create the master provenance salt.
   * Generated once and persisted to disk.
   */
  static getSalt(): string {
    if (saltCache) {return saltCache;}

    if (fs.existsSync(SALT_FILE)) {
      saltCache = fs.readFileSync(SALT_FILE, "utf-8").trim();
      return saltCache;
    }

    // Generate new salt
    const salt = crypto.randomBytes(32).toString("hex");
    if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR, { recursive: true });}
    fs.writeFileSync(SALT_FILE, salt, "utf-8");
    saltCache = salt;
    return salt;
  }

  /** Get human-readable date when salt was last rotated. */
  static getSaltRotationDate(): string {
    if (!fs.existsSync(SALT_FILE)) {return "NEVER";}
    try {
      const stat = fs.statSync(SALT_FILE);
      return stat.mtime.toISOString().slice(0, 16).replace("T", " ");
    } catch {
      return "UNKNOWN";
    }
  }

  /** Compute HMAC-SHA256 checksum for data bytes. */
  static computeChecksum(data: Buffer): string {
    const salt = ProvenanceManager.getSalt();
    return crypto.createHmac("sha256", salt).update(data).digest("hex");
  }

  /** Compute checksum for a file on disk. */
  static signFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot sign missing file: ${filePath}`);
    }
    return ProvenanceManager.computeChecksum(fs.readFileSync(filePath));
  }

  /**
   * Log an artifact to the immutable ledger.
   * Returns the HMAC-SHA256 checksum.
   */
  static logArtifact(
    filePath: string,
    artifactType: string,
    metadata: Record<string, unknown> = {},
  ): string {
    const checksum = ProvenanceManager.signFile(filePath);

    const entry: ProvenanceRecord = {
      timestamp: new Date().toISOString(),
      filePath,
      filename: path.basename(filePath),
      type: artifactType,
      checksum,
      metadata,
    };

    if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR, { recursive: true });}
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + "\n", "utf-8");

    console.log(`[Provenance] Logged: ${entry.filename} [${artifactType}]`);
    return checksum;
  }

  /** Verify a file's current checksum against an expected value. */
  static verifyFile(filePath: string, expectedChecksum?: string): boolean {
    const currentHash = ProvenanceManager.signFile(filePath);
    if (expectedChecksum) {
      return crypto.timingSafeEqual(
        Buffer.from(currentHash, "hex"),
        Buffer.from(expectedChecksum, "hex"),
      );
    }
    return true;
  }

  /** Check if a checksum exists in the ledger. */
  static isTracked(checksum: string): boolean {
    if (!fs.existsSync(LEDGER_FILE)) {return false;}
    try {
      const lines = fs.readFileSync(LEDGER_FILE, "utf-8").split("\n");
      return lines.some((line) => {
        if (!line.trim()) {return false;}
        try {
          return JSON.parse(line).checksum === checksum;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /** Look up artifact metadata by checksum. */
  static lookupByChecksum(checksum: string): ProvenanceRecord | null {
    if (!fs.existsSync(LEDGER_FILE)) {return null;}
    try {
      const lines = fs.readFileSync(LEDGER_FILE, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) {continue;}
        try {
          const entry = JSON.parse(line) as ProvenanceRecord;
          if (entry.checksum === checksum) {return entry;}
        } catch {
          continue;
        }
      }
    } catch {
      /* best-effort */
    }
    return null;
  }

  /** Compute checksum of a file and look up its provenance. */
  static lookupByFile(filePath: string): ProvenanceRecord | null {
    try {
      const checksum = ProvenanceManager.signFile(filePath);
      return ProvenanceManager.lookupByChecksum(checksum);
    } catch {
      return null;
    }
  }

  /** Human-readable provenance summary for a file. */
  static getArtifactInfo(filePath: string): string {
    const record = ProvenanceManager.lookupByFile(filePath);
    if (!record) {return "Unknown artifact (not in provenance ledger)";}

    const meta = record.metadata || {};
    return (
      `**Provenance Verified**\n` +
      `- Created: ${record.timestamp}\n` +
      `- Type: ${record.type}\n` +
      `- User: ${(meta.user_id as string) ?? "Unknown"}\n` +
      `- Scope: ${(meta.scope as string) ?? "Unknown"}\n` +
      `- Checksum: ${record.checksum.slice(0, 16)}...`
    );
  }

  /**
   * Search the ledger for records matching a filename or query string.
   * Returns matching records (max 10).
   */
  static search(query: string): ProvenanceRecord[] {
    if (!fs.existsSync(LEDGER_FILE)) {return [];}
    const queryLower = query.toLowerCase();
    const matches: ProvenanceRecord[] = [];

    try {
      const lines = fs.readFileSync(LEDGER_FILE, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) {continue;}
        try {
          const entry = JSON.parse(line) as ProvenanceRecord;
          const filename = (entry.filename || "").toLowerCase();
          const prompt = String((entry.metadata?.prompt as string) || "").toLowerCase();
          const intention = String((entry.metadata?.intention as string) || "").toLowerCase();

          if (
            filename.includes(queryLower) ||
            prompt.includes(queryLower) ||
            intention.includes(queryLower)
          ) {
            matches.push(entry);
            if (matches.length >= 10) {break;}
          }
        } catch {
          continue;
        }
      }
    } catch {
      /* best-effort */
    }

    return matches;
  }
}
