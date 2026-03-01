import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OutreachManager } from "./outreach.js";

function createTempStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "outreach-test-"));
  return path.join(dir, "settings.json");
}

describe("OutreachManager", () => {
  let storePath: string;
  let manager: OutreachManager;

  beforeEach(() => {
    storePath = createTempStore();
    manager = new OutreachManager(storePath);
  });

  afterEach(() => {
    try {
      const dir = path.dirname(storePath);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ── Default Settings ──

  it("returns default settings for unknown users", () => {
    const settings = manager.getSettings("unknown-user");
    expect(settings.policy).toBe("private");
    expect(settings.frequency).toBe("medium");
    expect(settings.lastOutreach).toBeNull();
  });

  // ── canOutreach ──

  it("allows first outreach to any user", () => {
    const result = manager.canOutreach("new-user");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("First outreach");
  });

  it("blocks outreach when policy is none", () => {
    manager.setPolicy("user-1", "none");
    const result = manager.canOutreach("user-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("disabled");
  });

  it("allows unlimited frequency without timing check", () => {
    manager.setFrequency("user-1", "unlimited");
    manager.recordOutreach("user-1");
    const result = manager.canOutreach("user-1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("unlimited");
  });

  it("blocks outreach when too soon based on frequency", () => {
    manager.setFrequency("user-1", "low"); // 24h
    manager.recordOutreach("user-1");
    const result = manager.canOutreach("user-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Too soon");
  });

  it("allows outreach after sufficient time has passed", () => {
    manager.setFrequency("user-1", "high"); // 3h

    // Manually set lastOutreach to 4 hours ago
    const store = JSON.parse(fs.readFileSync(storePath, "utf-8") || "{}");
    if (!store["user-1"]) {
      store["user-1"] = { policy: "private", frequency: "high", lastOutreach: null };
    }
    store["user-1"].lastOutreach = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(storePath, JSON.stringify(store), "utf-8");

    const result = manager.canOutreach("user-1");
    expect(result.allowed).toBe(true);
  });

  // ── setPolicy ──

  it("sets policy and persists it", () => {
    const result = manager.setPolicy("user-2", "public");
    expect(result).toContain("✅");
    expect(result).toContain("public");

    // Re-create manager to verify persistence
    const manager2 = new OutreachManager(storePath);
    expect(manager2.getSettings("user-2").policy).toBe("public");
  });

  it("rejects invalid policy", () => {
    const result = manager.setPolicy("user-2", "invalid" as any);
    expect(result).toContain("❌");
  });

  // ── setFrequency ──

  it("sets frequency and persists it", () => {
    const result = manager.setFrequency("user-3", "high");
    expect(result).toContain("✅");
    expect(result).toContain("high");
    expect(result).toContain("3h");

    const manager2 = new OutreachManager(storePath);
    expect(manager2.getSettings("user-3").frequency).toBe("high");
  });

  it("rejects invalid frequency", () => {
    const result = manager.setFrequency("user-3", "invalid" as any);
    expect(result).toContain("❌");
  });

  // ── recordOutreach ──

  it("records outreach timestamp", () => {
    manager.recordOutreach("user-4");
    const settings = manager.getSettings("user-4");
    expect(settings.lastOutreach).not.toBeNull();
    const ts = new Date(settings.lastOutreach!).getTime();
    expect(Math.abs(ts - Date.now())).toBeLessThan(5000);
  });

  // ── getAllSettings ──

  it("returns all user settings", () => {
    manager.setPolicy("user-a", "public");
    manager.setFrequency("user-b", "high");
    const all = manager.getAllSettings();
    expect(all["user-a"]?.policy).toBe("public");
    expect(all["user-b"]?.frequency).toBe("high");
  });
});
