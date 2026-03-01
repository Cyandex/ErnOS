/**
 * Privacy Scope Engine — ported from ErnOS 3.0 privacy/scopes.py
 *
 * Defines the 5-level privacy scope hierarchy and provides user data silo
 * resolution, scope determination from session context, and cross-scope
 * access checking.
 *
 * Scope Hierarchy (most to least restrictive):
 *   CORE_PRIVATE → sees everything (internal safety, autobiography)
 *   PRIVATE      → user DMs: sees own data + PUBLIC + CORE_PUBLIC
 *   CORE_PUBLIC  → shareable world knowledge: sees CORE_PUBLIC + PUBLIC
 *   PUBLIC       → guild channels: sees PUBLIC + CORE_PUBLIC only
 *   OPEN         → no constraints (disabled by default)
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { deriveSessionChatType } from "../sessions/session-key-utils.js";

// ─── Privacy Scope Enum ────────────────────────────────────────────────

export const PrivacyScope = {
  /** Internal only — safety systems, autobiography, core memory */
  CORE_PRIVATE: "CORE_PRIVATE",
  /** User DM — per-user isolated context */
  PRIVATE: "PRIVATE",
  /** Shareable world knowledge created by Ernos */
  CORE_PUBLIC: "CORE_PUBLIC",
  /** Public channels — guild/group context */
  PUBLIC: "PUBLIC",
  /** No constraints (used when privacy scopes are disabled) */
  OPEN: "OPEN",
} as const;

export type PrivacyScopeValue = (typeof PrivacyScope)[keyof typeof PrivacyScope];

// ─── Scope Hierarchy ───────────────────────────────────────────────────

const SCOPE_LEVEL: Record<PrivacyScopeValue, number> = {
  CORE_PRIVATE: 5,
  PRIVATE: 4,
  CORE_PUBLIC: 3,
  PUBLIC: 2,
  OPEN: 1,
};

/**
 * Check if a request scope has permission to access a resource scope.
 *
 * Access rules (from V3 privacy/scopes.py):
 * - CORE_PRIVATE: sees everything
 * - PRIVATE: sees PRIVATE + PUBLIC + CORE_PUBLIC (but NOT other users' PRIVATE)
 * - CORE_PUBLIC: sees CORE_PUBLIC + PUBLIC
 * - PUBLIC: sees PUBLIC + CORE_PUBLIC only
 * - OPEN: sees everything (only when privacy is disabled)
 */
export function checkScopeAccess(
  requestScope: PrivacyScopeValue,
  resourceScope: PrivacyScopeValue,
): boolean {
  // OPEN mode — no constraints
  if (requestScope === PrivacyScope.OPEN) {
    return true;
  }

  // CORE_PRIVATE sees everything
  if (requestScope === PrivacyScope.CORE_PRIVATE) {
    return true;
  }

  // CORE_PUBLIC sees CORE_PUBLIC + PUBLIC
  if (requestScope === PrivacyScope.CORE_PUBLIC) {
    return resourceScope === PrivacyScope.CORE_PUBLIC || resourceScope === PrivacyScope.PUBLIC;
  }

  // PRIVATE sees PRIVATE + PUBLIC + CORE_PUBLIC
  if (requestScope === PrivacyScope.PRIVATE) {
    return (
      resourceScope === PrivacyScope.PRIVATE ||
      resourceScope === PrivacyScope.PUBLIC ||
      resourceScope === PrivacyScope.CORE_PUBLIC
    );
  }

  // PUBLIC sees only PUBLIC + CORE_PUBLIC
  if (requestScope === PrivacyScope.PUBLIC) {
    return resourceScope === PrivacyScope.PUBLIC || resourceScope === PrivacyScope.CORE_PUBLIC;
  }

  return false;
}

// ─── Scope Resolution ──────────────────────────────────────────────────

/**
 * Determine the privacy scope from session context.
 * DM sessions → PRIVATE, guild/group → PUBLIC, internal → CORE_PRIVATE.
 */
export function resolveScope(params: {
  sessionKey?: string;
  isDm?: boolean;
  isCore?: boolean;
}): PrivacyScopeValue {
  if (params.isCore) {
    return PrivacyScope.CORE_PRIVATE;
  }

  // Check session key for chat type
  if (params.sessionKey) {
    const chatType = deriveSessionChatType(params.sessionKey);
    if (chatType === "direct") {
      return PrivacyScope.PRIVATE;
    }
  }

  // Explicit DM flag
  if (params.isDm) {
    return PrivacyScope.PRIVATE;
  }

  return PrivacyScope.PUBLIC;
}

// ─── User Data Silos ───────────────────────────────────────────────────

/**
 * Resolve the per-user private data directory.
 * Format: {stateDir}/workspace/memory/users/{userId}/
 *
 * Creates the directory if it doesn't exist.
 * Falls back to searching for existing dirs starting with the user ID
 * (supports folders like "123456" or "123456-Username").
 */
export function resolveUserDataDir(userId: string, stateDir?: string): string {
  const base = stateDir ?? resolveStateDir();
  const usersDir = path.join(base, "workspace", "memory", "users");

  if (!userId || userId === "CORE") {
    const corePath = path.join(base, "workspace", "memory", "core");
    fs.mkdirSync(corePath, { recursive: true });
    return corePath;
  }

  // Search for existing directory starting with this user ID
  if (fs.existsSync(usersDir)) {
    try {
      const entries = fs.readdirSync(usersDir);
      for (const entry of entries) {
        if (entry.startsWith(userId)) {
          const fullPath = path.join(usersDir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            return fullPath;
          }
        }
      }
    } catch {
      // Fall through to create new directory
    }
  }

  // Create new directory for this user
  const userPath = path.join(usersDir, userId);
  fs.mkdirSync(userPath, { recursive: true });
  return userPath;
}

/**
 * Resolve the per-user PUBLIC data directory.
 * Format: {stateDir}/workspace/memory/public/users/{userId}/
 *
 * This is the user's shareable data silo — accessible by all scopes.
 */
export function resolvePublicUserDir(userId: string, stateDir?: string): string {
  const base = stateDir ?? resolveStateDir();
  const publicPath = path.join(base, "workspace", "memory", "public", "users", userId);
  fs.mkdirSync(publicPath, { recursive: true });
  return publicPath;
}

/**
 * Resolve the core memory directory (internal-only data).
 */
export function resolveCoreDataDir(stateDir?: string): string {
  const base = stateDir ?? resolveStateDir();
  const corePath = path.join(base, "workspace", "memory", "core");
  fs.mkdirSync(corePath, { recursive: true });
  return corePath;
}

/**
 * Resolve the public memory directory (world knowledge).
 */
export function resolvePublicDataDir(stateDir?: string): string {
  const base = stateDir ?? resolveStateDir();
  const publicPath = path.join(base, "workspace", "memory", "public");
  fs.mkdirSync(publicPath, { recursive: true });
  return publicPath;
}

/**
 * Extract user ID from a session key (if present).
 * Discord DM keys: agent:main:discord:direct:<userId>
 */
export function extractUserIdFromSessionKey(sessionKey?: string): string | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const lower = sessionKey.trim().toLowerCase();
  // Pattern: ...direct:<userId> or ...dm:<userId>
  const directMatch = lower.match(/(?:direct|dm):(\d+)$/);
  if (directMatch) {
    return directMatch[1];
  }
  return undefined;
}

/**
 * Check if a scope is admin-level (CORE_PRIVATE).
 */
export function isAdminScope(scope: PrivacyScopeValue): boolean {
  return scope === PrivacyScope.CORE_PRIVATE;
}

/**
 * Get the numeric privilege level (higher = more access).
 */
export function getScopeLevel(scope: PrivacyScopeValue): number {
  return SCOPE_LEVEL[scope] ?? 0;
}
