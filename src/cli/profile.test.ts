import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs(["node", "ernos", "gateway", "--dev", "--allow-unconfigured"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "ernos", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "ernos", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "ernos", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "ernos", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "ernos", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "ernos", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "ernos", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "ernos", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".ernos-dev");
    expect(env.ERNOS_PROFILE).toBe("dev");
    expect(env.ERNOS_STATE_DIR).toBe(expectedStateDir);
    expect(env.ERNOS_CONFIG_PATH).toBe(path.join(expectedStateDir, "ernos.json"));
    expect(env.ERNOS_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      ERNOS_STATE_DIR: "/custom",
      ERNOS_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.ERNOS_STATE_DIR).toBe("/custom");
    expect(env.ERNOS_GATEWAY_PORT).toBe("19099");
    expect(env.ERNOS_CONFIG_PATH).toBe(path.join("/custom", "ernos.json"));
  });

  it("uses ERNOS_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      ERNOS_HOME: "/srv/ernos-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/ernos-home");
    expect(env.ERNOS_STATE_DIR).toBe(path.join(resolvedHome, ".ernos-work"));
    expect(env.ERNOS_CONFIG_PATH).toBe(path.join(resolvedHome, ".ernos-work", "ernos.json"));
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "ernos doctor --fix",
      env: {},
      expected: "ernos doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "ernos doctor --fix",
      env: { ERNOS_PROFILE: "default" },
      expected: "ernos doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "ernos doctor --fix",
      env: { ERNOS_PROFILE: "Default" },
      expected: "ernos doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "ernos doctor --fix",
      env: { ERNOS_PROFILE: "bad profile" },
      expected: "ernos doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "ernos --profile work doctor --fix",
      env: { ERNOS_PROFILE: "work" },
      expected: "ernos --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "ernos --dev doctor",
      env: { ERNOS_PROFILE: "dev" },
      expected: "ernos --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("ernos doctor --fix", { ERNOS_PROFILE: "work" })).toBe(
      "ernos --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("ernos doctor --fix", { ERNOS_PROFILE: "  jbernos  " })).toBe(
      "ernos --profile jbernos doctor --fix",
    );
  });

  it("handles command with no args after ernos", () => {
    expect(formatCliCommand("ernos", { ERNOS_PROFILE: "test" })).toBe("ernos --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm ernos doctor", { ERNOS_PROFILE: "work" })).toBe(
      "pnpm ernos --profile work doctor",
    );
  });
});
