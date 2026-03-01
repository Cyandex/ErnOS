import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#ernos",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#ernos",
      rawTarget: "#ernos",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "ernos-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "ernos-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "ernos-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "ernos-bot",
      rawTarget: "ernos-bot",
    });
  });
});
