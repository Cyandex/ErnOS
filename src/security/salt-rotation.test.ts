import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SaltRotationDaemon } from "./salt-rotation.js";

describe("SaltRotationDaemon", () => {
  let tmpDir: string;
  let saltPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "salt-test-"));
    saltPath = path.join(tmpDir, "crypto.salt");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rotateSalt creates a new salt file", async () => {
    const daemon = new SaltRotationDaemon(saltPath);
    await daemon.rotateSalt();
    expect(fs.existsSync(saltPath)).toBe(true);
    const salt = fs.readFileSync(saltPath, "utf-8");
    expect(salt).toHaveLength(64); // 32 bytes hex = 64 chars
  });

  it("rotateSalt backs up old salt", async () => {
    const daemon = new SaltRotationDaemon(saltPath);
    await daemon.rotateSalt();
    const oldSalt = fs.readFileSync(saltPath, "utf-8");
    await daemon.rotateSalt();
    const newSalt = fs.readFileSync(saltPath, "utf-8");
    expect(newSalt).not.toBe(oldSalt);
    expect(fs.existsSync(`${saltPath}.bak`)).toBe(true);
  });

  it("hashPII produces deterministic HMAC for same input/salt", async () => {
    const daemon = new SaltRotationDaemon(saltPath);
    await daemon.rotateSalt();

    const hash1 = daemon.hashPII("user@example.com");
    const hash2 = daemon.hashPII("user@example.com");
    expect(hash1).toBe(hash2);
  });

  it("hashPII produces different hashes for different inputs", async () => {
    const daemon = new SaltRotationDaemon(saltPath);
    await daemon.rotateSalt();

    const hash1 = daemon.hashPII("alice@example.com");
    const hash2 = daemon.hashPII("bob@example.com");
    expect(hash1).not.toBe(hash2);
  });

  it("hashPII auto-creates salt if missing", () => {
    const daemon = new SaltRotationDaemon(saltPath);
    // No explicit rotateSalt — hashPII should force-init
    const hash = daemon.hashPII("test@example.com");
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(fs.existsSync(saltPath)).toBe(true);
  });
});
