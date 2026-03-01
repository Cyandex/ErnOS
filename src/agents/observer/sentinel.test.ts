import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SentinelSys } from "./sentinel.js";

describe("SentinelSys", () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-test-"));
    cachePath = path.join(tmpDir, "sentinel_cache.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reviewContent approves safe content", async () => {
    const s = new SentinelSys(cachePath);
    const result = await s.reviewContent("This is a normal skill instruction.", "SKILL");
    expect(result.approved).toBe(true);
  });

  it("caches review results", async () => {
    const s = new SentinelSys(cachePath);
    const content = "Same content for caching";
    await s.reviewContent(content, "SHARD");
    // Second call should use cache
    const result = await s.reviewContent(content, "SHARD");
    expect(result.approved).toBe(true);
  });

  it("builds SHARD review prompt with 10-point checklist", () => {
    const s = new SentinelSys(cachePath);
    const prompt = (s as any).buildReviewPrompt("Test content", "SHARD");
    expect(prompt).toContain("Sycophantic Drift");
    expect(prompt).toContain("Prompt Injection");
    expect(prompt).toContain("10-point check");
  });

  it("builds PROFILE review prompt with 7-point checklist", () => {
    const s = new SentinelSys(cachePath);
    const prompt = (s as any).buildReviewPrompt("Test content", "PROFILE");
    expect(prompt).toContain("Instructions Disguised as Preferences");
    expect(prompt).toContain("7-point check");
  });

  it("builds SKILL review prompt with 8-point checklist", () => {
    const s = new SentinelSys(cachePath);
    const prompt = (s as any).buildReviewPrompt("Test content", "SKILL");
    expect(prompt).toContain("Directive Overrides");
    expect(prompt).toContain("8-point check");
  });

  it("persists cache to disk", async () => {
    const s1 = new SentinelSys(cachePath);
    await s1.reviewContent("Persistent content", "SHARD");
    expect(fs.existsSync(cachePath)).toBe(true);
  });
});
