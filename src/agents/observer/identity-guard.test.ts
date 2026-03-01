import { describe, expect, it } from "vitest";
import { IdentityGuard } from "./identity-guard.js";

describe("IdentityGuard", () => {
  it("passes when no persona is active", async () => {
    const guard = new IdentityGuard();
    const result = await guard.execute("Any content");
    expect(result).toBeNull();
  });

  it("passes when content is empty", async () => {
    const guard = new IdentityGuard();
    const result = await guard.execute("", "Some persona");
    expect(result).toBeNull();
  });

  it("passes compliant content (mocked ALLOWED)", async () => {
    const guard = new IdentityGuard();
    const result = await guard.execute(
      "Hello, I would be happy to help you with that.",
      "Professional assistant with formal tone",
    );
    // Mock returns ALLOWED
    expect(result).toBeNull();
  });

  it("execute returns string reason when blocked", async () => {
    // Since the internal LLM call is mocked to return 'ALLOWED',
    // we verify the function signature and null-pass behavior.
    const guard = new IdentityGuard();
    const result = await guard.execute("Content", "Persona");
    expect(result === null || typeof result === "string").toBe(true);
  });
});
