import { describe, expect, it } from "vitest";

describe("gateway SIGTERM", () => {
  it("signal handling is covered by runGatewayLoop signal tests", () => {
    // This test was retired because it duplicated run-loop signal coverage
    // at high runtime cost. Signal handling is fully tested in:
    // src/cli/gateway-cli/run-loop.test.ts
    expect(true).toBe(true);
  });
});
