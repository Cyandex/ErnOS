import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";

export interface QuarantinedFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  layer: string;
  source: string;
  confidence: number;
  quarantinedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export class ValidationQuarantine {
  private persistPath: string;
  private queue: Map<string, QuarantinedFact>;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "quarantine.json")) {
    this.persistPath = persistPath;
    this.queue = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        for (const key of Object.keys(parsed)) {
          this.queue.set(key, parsed[key] as QuarantinedFact);
        }
      }
    } catch (e) {
      console.warn(`Failed to load quarantine queue from disk: ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.queue);
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Failed to persist quarantine queue: ${e}`);
    }
  }

  public addFact(fact: Omit<QuarantinedFact, "id" | "quarantinedAt" | "status">): string {
    const id = `qfact_${randomUUID()}`;
    const qFact: QuarantinedFact = {
      ...fact,
      id,
      quarantinedAt: new Date().toISOString(),
      status: "PENDING",
    };

    this.queue.set(id, qFact);
    this.saveToDisk();
    return id;
  }

  public getPendingFacts(): QuarantinedFact[] {
    return Array.from(this.queue.values()).filter((f) => f.status === "PENDING");
  }

  public resolveFact(id: string, approved: boolean) {
    const fact = this.queue.get(id);
    if (fact) {
      fact.status = approved ? "APPROVED" : "REJECTED";
      this.saveToDisk();

      // If approved, it should be moved out by the caller usually, but we keep a history here for now
      if (approved) {
        this.queue.delete(id);
      }
    }
  }
}
