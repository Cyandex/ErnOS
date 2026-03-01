import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { STATE_DIR } from "../config/paths.js";

export interface ArtifactRecord {
  timestamp: number;
  type: string; // 'image', 'code', 'document', etc.
  path?: string;
  prompt?: string;
  context?: string;
}

export class ArtifactRegistry {
  private persistPath: string;

  constructor() {
    this.persistPath = path.join(STATE_DIR, "memory", "core", "artifact_registry.json");
  }

  private loadRegistry(): Record<string, ArtifactRecord> {
    try {
      if (fs.existsSync(this.persistPath)) {
        return JSON.parse(fs.readFileSync(this.persistPath, "utf-8"));
      }
    } catch (e) {
      console.warn(`[ArtifactRegistry] Load failed: ${e}`);
    }
    return {};
  }

  private saveRegistry(data: Record<string, ArtifactRecord>) {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`[ArtifactRegistry] Save failed: ${e}`);
    }
  }

  public computeHash(buffer: Buffer | string): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  public registerArtifact(buffer: Buffer | string, record: Omit<ArtifactRecord, "timestamp">): string {
    const hash = this.computeHash(buffer);
    const registry = this.loadRegistry();
    
    // Only register if we haven't seen this exact artifact before
    if (!registry[hash]) {
      registry[hash] = {
        ...record,
        timestamp: Date.now(),
      };
      this.saveRegistry(registry);
      console.log(`[ArtifactRegistry] Registered pristine artifact: ${hash}`);
    }
    return hash;
  }

  public verifyArtifact(buffer: Buffer | string): ArtifactRecord | null {
    const hash = this.computeHash(buffer);
    const registry = this.loadRegistry();
    return registry[hash] || null;
  }
}

export const artifactRegistry = new ArtifactRegistry();
