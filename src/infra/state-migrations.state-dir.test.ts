import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  autoMigrateLegacyStateDir,
  resetAutoMigrateLegacyStateDirForTest,
} from "./state-migrations.js";

let tempRoot: string | null = null;

async function makeTempRoot() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ernos-state-dir-"));
  tempRoot = root;
  return root;
}

afterEach(async () => {
  resetAutoMigrateLegacyStateDirForTest();
  if (!tempRoot) {
    return;
  }
  await fs.promises.rm(tempRoot, { recursive: true, force: true });
  tempRoot = null;
});

describe("legacy state dir auto-migration", () => {
  it("skips migration when legacy dir is the same as target dir (post-rebrand)", async () => {
    const root = await makeTempRoot();
    // After rebrand, legacyDir === targetDir === ".ernos"
    const targetDir = path.join(root, ".ernos");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "marker.txt"), "ok", "utf-8");

    const result = await autoMigrateLegacyStateDir({
      env: {} as NodeJS.ProcessEnv,
      homedir: () => root,
    });

    // Target already exists (it IS the legacy dir), so migration skips
    expect(result.migrated).toBe(false);

    // Marker file should still be there
    expect(fs.readFileSync(path.join(targetDir, "marker.txt"), "utf-8")).toBe("ok");
  });
});
