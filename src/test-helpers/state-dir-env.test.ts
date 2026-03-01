import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  restoreStateDirEnv,
  setStateDirEnv,
  snapshotStateDirEnv,
  withStateDirEnv,
} from "./state-dir-env.js";

function snapshotCurrentStateDirVars() {
  return {
    ernos: process.env.ERNOS_STATE_DIR,
  };
}

function expectStateDirVars(snapshot: { ernos?: string }) {
  expect(process.env.ERNOS_STATE_DIR).toBe(snapshot.ernos);
}

async function expectPathMissing(filePath: string) {
  await expect(fs.stat(filePath)).rejects.toThrow();
}

async function expectStateDirEnvRestored(params: {
  prev: { ernos?: string };
  capturedStateDir: string;
  capturedTempRoot: string;
}) {
  expectStateDirVars(params.prev);
  await expectPathMissing(params.capturedStateDir);
  await expectPathMissing(params.capturedTempRoot);
}

describe("state-dir-env helpers", () => {
  it("set/snapshot/restore round-trips ERNOS_STATE_DIR", () => {
    const prev = snapshotCurrentStateDirVars();
    const snapshot = snapshotStateDirEnv();

    setStateDirEnv("/tmp/ernos-state-dir-test");
    expect(process.env.ERNOS_STATE_DIR).toBe("/tmp/ernos-state-dir-test");

    restoreStateDirEnv(snapshot);
    expectStateDirVars(prev);
  });

  it("withStateDirEnv sets env for callback and cleans up temp root", async () => {
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    await withStateDirEnv("ernos-state-dir-env-", async ({ tempRoot, stateDir }) => {
      capturedTempRoot = tempRoot;
      capturedStateDir = stateDir;
      expect(process.env.ERNOS_STATE_DIR).toBe(stateDir);
      await fs.writeFile(path.join(stateDir, "probe.txt"), "ok", "utf8");
    });

    await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
  });

  it("withStateDirEnv restores env and cleans temp root when callback throws", async () => {
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    await expect(
      withStateDirEnv("ernos-state-dir-env-", async ({ tempRoot, stateDir }) => {
        capturedTempRoot = tempRoot;
        capturedStateDir = stateDir;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
  });

  it("withStateDirEnv restores env var when it was previously set", async () => {
    const testSnapshot = snapshotStateDirEnv();
    process.env.ERNOS_STATE_DIR = "/tmp/original-ernos";
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    try {
      await withStateDirEnv("ernos-state-dir-env-", async ({ tempRoot, stateDir }) => {
        capturedTempRoot = tempRoot;
        capturedStateDir = stateDir;
        expect(process.env.ERNOS_STATE_DIR).toBe(stateDir);
      });

      await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
    } finally {
      restoreStateDirEnv(testSnapshot);
    }
  });
});
