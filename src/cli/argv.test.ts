import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "ernos", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "ernos", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "ernos", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "ernos", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "ernos", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "ernos", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "ernos", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "ernos", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "ernos", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "ernos", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "ernos", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "ernos", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "ernos", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "ernos"],
      expected: null,
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "ernos", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "ernos", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "ernos", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "ernos", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "ernos", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "ernos", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "ernos", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "ernos", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "ernos", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "ernos", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "ernos", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "ernos", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "ernos", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "ernos", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "ernos", "status"],
        expected: ["node", "ernos", "status"],
      },
      {
        rawArgs: ["node-22", "ernos", "status"],
        expected: ["node-22", "ernos", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "ernos", "status"],
        expected: ["node-22.2.0.exe", "ernos", "status"],
      },
      {
        rawArgs: ["node-22.2", "ernos", "status"],
        expected: ["node-22.2", "ernos", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "ernos", "status"],
        expected: ["node-22.2.exe", "ernos", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "ernos", "status"],
        expected: ["/usr/bin/node-22.2.0", "ernos", "status"],
      },
      {
        rawArgs: ["node24", "ernos", "status"],
        expected: ["node24", "ernos", "status"],
      },
      {
        rawArgs: ["/usr/bin/node24", "ernos", "status"],
        expected: ["/usr/bin/node24", "ernos", "status"],
      },
      {
        rawArgs: ["node24.exe", "ernos", "status"],
        expected: ["node24.exe", "ernos", "status"],
      },
      {
        rawArgs: ["nodejs", "ernos", "status"],
        expected: ["nodejs", "ernos", "status"],
      },
      {
        rawArgs: ["node-dev", "ernos", "status"],
        expected: ["node", "ernos", "node-dev", "ernos", "status"],
      },
      {
        rawArgs: ["ernos", "status"],
        expected: ["node", "ernos", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "ernos",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "ernos",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "ernos", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "ernos", "status"],
      ["node", "ernos", "health"],
      ["node", "ernos", "sessions"],
      ["node", "ernos", "config", "get", "update"],
      ["node", "ernos", "config", "unset", "update"],
      ["node", "ernos", "models", "list"],
      ["node", "ernos", "models", "status"],
      ["node", "ernos", "memory", "status"],
      ["node", "ernos", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "ernos", "agents", "list"],
      ["node", "ernos", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
