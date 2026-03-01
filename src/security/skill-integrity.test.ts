import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { computeManifest, writeManifest, readManifest, verifyManifest } from "./skill-integrity.js";

describe("skill-integrity", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integrity-test-"));
    // Create sample skill files
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "export const skill = true;", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "helper.ts"), "export function help() {}", "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computeManifest generates hashes for all files", async () => {
    const manifest = await computeManifest(tmpDir);
    expect(manifest.version).toBe(1);
    expect(manifest.createdAt).toBeDefined();
    expect(Object.keys(manifest.hashes)).toHaveLength(2);
    expect(manifest.hashes["index.ts"]).toMatch(/^sha256:/);
    expect(manifest.hashes["helper.ts"]).toMatch(/^sha256:/);
  });

  it("writeManifest and readManifest round-trip", async () => {
    const manifest = await computeManifest(tmpDir);
    await writeManifest(tmpDir, manifest);
    const loaded = await readManifest(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.hashes).toEqual(manifest.hashes);
  });

  it("readManifest returns null when file does not exist", async () => {
    const result = await readManifest(path.join(tmpDir, "nonexistent"));
    expect(result).toBeNull();
  });

  it("verifyManifest passes for unmodified files", async () => {
    const manifest = await computeManifest(tmpDir);
    const result = await verifyManifest(tmpDir, manifest);
    expect(result.valid).toBe(true);
    expect(result.tamperedFiles).toHaveLength(0);
    expect(result.missingFiles).toHaveLength(0);
    expect(result.newFiles).toHaveLength(0);
  });

  it("verifyManifest detects tampered files", async () => {
    const manifest = await computeManifest(tmpDir);
    // Tamper with a file
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "TAMPERED CONTENT", "utf-8");
    const result = await verifyManifest(tmpDir, manifest);
    expect(result.valid).toBe(false);
    expect(result.tamperedFiles).toContain("index.ts");
  });

  it("verifyManifest detects missing files", async () => {
    const manifest = await computeManifest(tmpDir);
    // Delete a file
    fs.unlinkSync(path.join(tmpDir, "helper.ts"));
    const result = await verifyManifest(tmpDir, manifest);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain("helper.ts");
  });

  it("verifyManifest detects new files", async () => {
    const manifest = await computeManifest(tmpDir);
    // Add a new file
    fs.writeFileSync(path.join(tmpDir, "malicious.ts"), "evil code", "utf-8");
    const result = await verifyManifest(tmpDir, manifest);
    expect(result.valid).toBe(false);
    expect(result.newFiles).toContain("malicious.ts");
  });
});
