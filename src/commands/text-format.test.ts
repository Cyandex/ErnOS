import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("ernos", 16)).toBe("ernos");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("ernos-status-output", 10)).toBe("ernos-sta…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
