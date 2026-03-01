import { describe, expect, it, vi } from "vitest";
import { checkEgressTarget } from "./egress-filter.js";

// Mock DNS lookup to avoid real DNS calls in tests
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockImplementation(async (hostname: string) => {
    const dnsMap: Record<string, string> = {
      "example.com": "93.184.216.34", // public
      localhost: "127.0.0.1", // loopback
      "internal.corp": "10.0.0.5", // private
      "link-local.test": "169.254.1.1", // link-local
    };
    const ip = dnsMap[hostname];
    if (!ip) throw new Error(`ENOTFOUND: ${hostname}`);
    return { address: ip, family: 4 };
  }),
}));

describe("checkEgressTarget", () => {
  it("allows public internet URLs", async () => {
    const r = await checkEgressTarget("https://example.com/api");
    expect(r.allowed).toBe(true);
  });

  it("blocks localhost", async () => {
    const r = await checkEgressTarget("http://localhost:8080");
    expect(r.allowed).toBe(false);
  });

  it("blocks 127.0.0.1 directly", async () => {
    const r = await checkEgressTarget("http://127.0.0.1:11434");
    expect(r.allowed).toBe(false);
  });

  it("blocks private 10.x.x.x", async () => {
    const r = await checkEgressTarget("http://internal.corp/api");
    expect(r.allowed).toBe(false);
  });

  it("blocks 192.168.x.x", async () => {
    const r = await checkEgressTarget("http://192.168.1.1/admin");
    expect(r.allowed).toBe(false);
  });

  it("blocks 169.254.x.x link-local", async () => {
    const r = await checkEgressTarget("http://link-local.test");
    expect(r.allowed).toBe(false);
  });

  it("rejects invalid URLs", async () => {
    const r = await checkEgressTarget("not a url");
    expect(r.allowed).toBe(false);
  });

  it("respects allowedInternalHosts", async () => {
    const r = await checkEgressTarget("http://localhost:11434", {
      allowedInternalHosts: ["localhost"],
    });
    expect(r.allowed).toBe(true);
  });

  it("disabled when blockPrivateIPs is false", async () => {
    const r = await checkEgressTarget("http://10.0.0.1", {
      blockPrivateIPs: false,
    });
    expect(r.allowed).toBe(true);
  });

  it("allows on DNS failure (fail-open)", async () => {
    const r = await checkEgressTarget("http://nonexistent-domain.invalid");
    expect(r.allowed).toBe(true);
  });
});
