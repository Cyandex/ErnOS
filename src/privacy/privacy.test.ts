import { describe, expect, it } from "vitest";
import { validatePathScope, resolveWritePath } from "./guard.js";
import {
  PrivacyScope,
  checkScopeAccess,
  resolveScope,
  extractUserIdFromSessionKey,
  isAdminScope,
} from "./scope.js";
import { isToolAllowed, filterToolsByScope } from "./tool-guard.js";

// ─── Scope Access Hierarchy ────────────────────────────────────────────

describe("checkScopeAccess", () => {
  it("CORE_PRIVATE sees everything", () => {
    expect(checkScopeAccess("CORE_PRIVATE", "CORE_PRIVATE")).toBe(true);
    expect(checkScopeAccess("CORE_PRIVATE", "PRIVATE")).toBe(true);
    expect(checkScopeAccess("CORE_PRIVATE", "PUBLIC")).toBe(true);
    expect(checkScopeAccess("CORE_PRIVATE", "CORE_PUBLIC")).toBe(true);
  });

  it("PRIVATE sees PRIVATE + PUBLIC + CORE_PUBLIC", () => {
    expect(checkScopeAccess("PRIVATE", "PRIVATE")).toBe(true);
    expect(checkScopeAccess("PRIVATE", "PUBLIC")).toBe(true);
    expect(checkScopeAccess("PRIVATE", "CORE_PUBLIC")).toBe(true);
    expect(checkScopeAccess("PRIVATE", "CORE_PRIVATE")).toBe(false);
  });

  it("PUBLIC sees only PUBLIC + CORE_PUBLIC", () => {
    expect(checkScopeAccess("PUBLIC", "PUBLIC")).toBe(true);
    expect(checkScopeAccess("PUBLIC", "CORE_PUBLIC")).toBe(true);
    expect(checkScopeAccess("PUBLIC", "PRIVATE")).toBe(false);
    expect(checkScopeAccess("PUBLIC", "CORE_PRIVATE")).toBe(false);
  });

  it("CORE_PUBLIC sees CORE_PUBLIC + PUBLIC", () => {
    expect(checkScopeAccess("CORE_PUBLIC", "CORE_PUBLIC")).toBe(true);
    expect(checkScopeAccess("CORE_PUBLIC", "PUBLIC")).toBe(true);
    expect(checkScopeAccess("CORE_PUBLIC", "PRIVATE")).toBe(false);
    expect(checkScopeAccess("CORE_PUBLIC", "CORE_PRIVATE")).toBe(false);
  });

  it("OPEN sees everything", () => {
    expect(checkScopeAccess("OPEN", "CORE_PRIVATE")).toBe(true);
    expect(checkScopeAccess("OPEN", "PRIVATE")).toBe(true);
  });
});

// ─── Scope Resolution ──────────────────────────────────────────────────

describe("resolveScope", () => {
  it("DM sessions resolve to PRIVATE", () => {
    expect(resolveScope({ isDm: true })).toBe("PRIVATE");
    expect(resolveScope({ sessionKey: "discord:direct:123456" })).toBe("PRIVATE");
  });

  it("group/channel sessions resolve to PUBLIC", () => {
    expect(resolveScope({ sessionKey: "discord:channel:general" })).toBe("PUBLIC");
    expect(resolveScope({})).toBe("PUBLIC");
  });

  it("core sessions resolve to CORE_PRIVATE", () => {
    expect(resolveScope({ isCore: true })).toBe("CORE_PRIVATE");
  });
});

// ─── User ID Extraction ────────────────────────────────────────────────

describe("extractUserIdFromSessionKey", () => {
  it("extracts from direct session keys", () => {
    expect(extractUserIdFromSessionKey("discord:direct:123456789")).toBe("123456789");
    expect(extractUserIdFromSessionKey("discord:dm:987654321")).toBe("987654321");
  });

  it("returns undefined for non-DM keys", () => {
    expect(extractUserIdFromSessionKey("discord:channel:general")).toBeUndefined();
    expect(extractUserIdFromSessionKey(undefined)).toBeUndefined();
  });
});

// ─── Path Validation ───────────────────────────────────────────────────

describe("validatePathScope", () => {
  it("allows PUBLIC access to memory/public/", () => {
    expect(
      validatePathScope({
        path: "memory/public/timeline.jsonl",
        requestScope: "PUBLIC",
      }),
    ).toBe(true);
  });

  it("blocks PUBLIC access to memory/core/ (non-artifact)", () => {
    expect(
      validatePathScope({
        path: "memory/core/autobiography.md",
        requestScope: "PUBLIC",
      }),
    ).toBe(false);
  });

  it("allows PUBLIC access to core shareable artifacts", () => {
    expect(
      validatePathScope({
        path: "memory/core/research/paper.md",
        requestScope: "PUBLIC",
      }),
    ).toBe(true);
  });

  it("blocks cross-user access", () => {
    expect(
      validatePathScope({
        path: "memory/users/111/notes.md",
        requestScope: "PRIVATE",
        userId: "222",
      }),
    ).toBe(false);
  });

  it("allows same-user access", () => {
    expect(
      validatePathScope({
        path: "memory/users/111/notes.md",
        requestScope: "PRIVATE",
        userId: "111",
      }),
    ).toBe(true);
  });

  it("blocks traversal attacks", () => {
    expect(
      validatePathScope({
        path: "memory/public/../../core/autobiography.md",
        requestScope: "PUBLIC",
      }),
    ).toBe(false);
  });

  it("allows non-memory paths (src/, docs/)", () => {
    expect(
      validatePathScope({
        path: "src/main.ts",
        requestScope: "PUBLIC",
      }),
    ).toBe(true);
  });

  it("blocks user directory listing for non-CORE", () => {
    expect(
      validatePathScope({
        path: "memory/users/",
        requestScope: "PUBLIC",
      }),
    ).toBe(false);
  });

  it("allows CORE_PRIVATE to access everything", () => {
    expect(
      validatePathScope({
        path: "memory/users/111/notes.md",
        requestScope: "CORE_PRIVATE",
        userId: "999",
      }),
    ).toBe(true);
  });

  it("allows PUBLIC access to user's public projects", () => {
    expect(
      validatePathScope({
        path: "memory/users/111/projects/public/readme.md",
        requestScope: "PUBLIC",
      }),
    ).toBe(true);
  });
});

// ─── Write Path Resolution ─────────────────────────────────────────────

describe("resolveWritePath", () => {
  it("CORE writes to memory/core", () => {
    expect(resolveWritePath({ scope: "CORE_PRIVATE", baseDir: "/base" })).toBe("/base/memory/core");
  });

  it("PRIVATE with userId writes to user silo", () => {
    expect(resolveWritePath({ scope: "PRIVATE", userId: "123", baseDir: "/base" })).toBe(
      "/base/memory/users/123",
    );
  });

  it("PUBLIC defaults to memory/public", () => {
    expect(resolveWritePath({ scope: "PUBLIC", baseDir: "/base" })).toBe("/base/memory/public");
  });
});

// ─── Tool Access Guard ─────────────────────────────────────────────────

describe("isToolAllowed", () => {
  it("CORE_PRIVATE allows all tools", () => {
    expect(isToolAllowed("exec", "CORE_PRIVATE").allowed).toBe(true);
    expect(isToolAllowed("file_write", "CORE_PRIVATE").allowed).toBe(true);
    expect(isToolAllowed("shutdown", "CORE_PRIVATE").allowed).toBe(true);
  });

  it("PUBLIC blocks admin-only tools", () => {
    expect(isToolAllowed("exec", "PUBLIC").allowed).toBe(false);
    expect(isToolAllowed("file_write", "PUBLIC").allowed).toBe(false);
    expect(isToolAllowed("shell", "PUBLIC").allowed).toBe(false);
    expect(isToolAllowed("shutdown", "PUBLIC").allowed).toBe(false);
  });

  it("PUBLIC allows safe tools", () => {
    expect(isToolAllowed("search", "PUBLIC").allowed).toBe(true);
    expect(isToolAllowed("web_search", "PUBLIC").allowed).toBe(true);
    expect(isToolAllowed("summarize", "PUBLIC").allowed).toBe(true);
  });

  it("PRIVATE allows private-safe + public-safe tools", () => {
    expect(isToolAllowed("memory_read", "PRIVATE").allowed).toBe(true);
    expect(isToolAllowed("recall", "PRIVATE").allowed).toBe(true);
    expect(isToolAllowed("search", "PRIVATE").allowed).toBe(true);
  });

  it("PRIVATE blocks admin-only tools", () => {
    expect(isToolAllowed("exec", "PRIVATE").allowed).toBe(false);
    expect(isToolAllowed("file_write", "PRIVATE").allowed).toBe(false);
  });

  it("PUBLIC blocks private-only tools", () => {
    expect(isToolAllowed("memory_read", "PUBLIC").allowed).toBe(false);
    expect(isToolAllowed("journal", "PUBLIC").allowed).toBe(false);
  });
});

describe("filterToolsByScope", () => {
  const tools = [
    { name: "exec" },
    { name: "search" },
    { name: "memory_read" },
    { name: "file_write" },
  ];

  it("CORE_PRIVATE keeps all tools", () => {
    const filtered = filterToolsByScope(tools, "CORE_PRIVATE");
    expect(filtered).toHaveLength(4);
  });

  it("PUBLIC removes admin and private tools", () => {
    const filtered = filterToolsByScope(tools, "PUBLIC");
    expect(filtered.map((t) => t.name)).toEqual(["search"]);
  });

  it("PRIVATE removes admin tools but keeps private + public", () => {
    const filtered = filterToolsByScope(tools, "PRIVATE");
    const names = filtered.map((t) => t.name);
    expect(names).toContain("search");
    expect(names).toContain("memory_read");
    expect(names).not.toContain("exec");
    expect(names).not.toContain("file_write");
  });
});

// ─── Admin Scope Check ─────────────────────────────────────────────────

describe("isAdminScope", () => {
  it("only CORE_PRIVATE is admin", () => {
    expect(isAdminScope("CORE_PRIVATE")).toBe(true);
    expect(isAdminScope("PRIVATE")).toBe(false);
    expect(isAdminScope("PUBLIC")).toBe(false);
  });
});
