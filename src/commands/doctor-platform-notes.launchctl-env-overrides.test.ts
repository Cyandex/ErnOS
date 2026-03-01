import { describe, expect, it, vi } from "vitest";
import type { ErnOSConfig } from "../config/config.js";
import { noteMacLaunchctlGatewayEnvOverrides } from "./doctor-platform-notes.js";

describe("noteMacLaunchctlGatewayEnvOverrides", () => {
  it("prints clear unsetenv instructions for token override", async () => {
    const noteFn = vi.fn();
    const getenv = vi.fn(async (name: string) =>
      name === "ERNOS_GATEWAY_TOKEN" ? "launchctl-token" : undefined,
    );
    const cfg = {
      gateway: {
        auth: {
          token: "config-token",
        },
      },
    } as ErnOSConfig;

    await noteMacLaunchctlGatewayEnvOverrides(cfg, { platform: "darwin", getenv, noteFn });

    expect(noteFn).toHaveBeenCalledTimes(2);
    expect(getenv).toHaveBeenCalledTimes(4);

    // After rebrand, ERNOS_GATEWAY_TOKEN is both deprecated AND current,
    // so noteFn fires twice: calls[0] = deprecated warning, calls[1] = overrides
    const [deprecatedMessage, deprecatedTitle] = noteFn.mock.calls[0] ?? [];
    expect(deprecatedTitle).toBe("Gateway (macOS)");
    expect(deprecatedMessage).toContain("Deprecated launchctl environment variables detected");

    const [message, title] = noteFn.mock.calls[1] ?? [];
    expect(title).toBe("Gateway (macOS)");
    expect(message).toContain("launchctl environment overrides detected");
    expect(message).toContain("ERNOS_GATEWAY_TOKEN");
    expect(message).toContain("launchctl unsetenv ERNOS_GATEWAY_TOKEN");
    expect(message).not.toContain("ERNOS_GATEWAY_PASSWORD");
  });

  it("does nothing when config has no gateway credentials", async () => {
    const noteFn = vi.fn();
    const getenv = vi.fn(async () => "launchctl-token");
    const cfg = {} as ErnOSConfig;

    await noteMacLaunchctlGatewayEnvOverrides(cfg, { platform: "darwin", getenv, noteFn });

    expect(getenv).not.toHaveBeenCalled();
    expect(noteFn).not.toHaveBeenCalled();
  });

  it("does nothing on non-darwin platforms", async () => {
    const noteFn = vi.fn();
    const getenv = vi.fn(async () => "launchctl-token");
    const cfg = {
      gateway: {
        auth: {
          token: "config-token",
        },
      },
    } as ErnOSConfig;

    await noteMacLaunchctlGatewayEnvOverrides(cfg, { platform: "linux", getenv, noteFn });

    expect(getenv).not.toHaveBeenCalled();
    expect(noteFn).not.toHaveBeenCalled();
  });
});
