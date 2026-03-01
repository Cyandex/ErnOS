/**
 * Privacy Guard — ported from ErnOS 3.0 privacy/guard.py
 *
 * Enforces scope-based access control on file paths.
 * DENY-BY-DEFAULT for all memory paths:
 *
 * - memory/public/                           → PUBLIC (anyone)
 * - memory/core/research|media|exports|skills → PUBLIC (Ernos's shareable artifacts)
 * - memory/core/**                           → CORE only
 * - memory/users/{id}/                       → ONLY the owning user or CORE
 * - memory/users/{id}/projects/public/       → PUBLIC (user's public projects)
 * - memory/users/{id}/research/public/       → PUBLIC (user's public research)
 * - memory/backups/**                        → CORE only
 * - memory/cache/**                          → CORE only
 * - memory/system/**                         → CORE only
 * - memory/** (anything else)                → CORE only (deny-by-default)
 * - Non-memory paths (src/, docs/, etc.)     → PUBLIC (readable by all)
 *
 * CRITICAL: Cross-user access (User A reading User B's files) is BLOCKED.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { type PrivacyScopeValue, PrivacyScope, checkScopeAccess } from "./scope.js";

const log = createSubsystemLogger("privacy-guard");

// Ernos's own shareable artifact directories under memory/core/
const CORE_PUBLIC_ARTIFACT_DIRS = [
  "memory/core/research",
  "memory/core/media",
  "memory/core/exports",
  "memory/core/skills",
];

/**
 * Validate that a file path is accessible by the given scope and user.
 *
 * Returns true if access is allowed, false if blocked.
 * Implements deny-by-default for all memory/ paths.
 */
export function validatePathScope(params: {
  path: string;
  requestScope: PrivacyScopeValue;
  userId?: string;
}): boolean {
  const { requestScope, userId } = params;

  // ── PATH NORMALIZATION — PREVENT TRAVERSAL ATTACKS ──────────────────
  const normalized = normalizePath(params.path);
  if (!normalized) {
    log.warn(`PATH BLOCKED (invalid): "${params.path}"`);
    return false;
  }

  const pathLower = normalized.toLowerCase();

  // ── TRAVERSAL ESCAPE DETECTION ──────────────────────────────────────
  const originalLower = params.path.toLowerCase().replaceAll("\\", "/");
  const originalRefsMemory =
    originalLower.includes("memory/") || originalLower.startsWith("memory");
  const normalizedRefsMemory = pathLower.includes("memory/") || pathLower.startsWith("memory");
  if (originalRefsMemory && !normalizedRefsMemory) {
    log.warn(
      `TRAVERSAL ESCAPE BLOCKED: "${params.path}" normalized to "${normalized}" (escaped memory/ boundary)`,
    );
    return false;
  }

  // Reject paths that break out of project root
  if (pathLower.startsWith("..")) {
    return false;
  }

  // ── NON-MEMORY PATHS ────────────────────────────────────────────────
  // src/, docs/, config/, etc. are PUBLIC-readable
  if (
    pathLower.startsWith("src/") ||
    pathLower.startsWith("tests/") ||
    pathLower.startsWith("docs/")
  ) {
    return true;
  }

  if (!pathLower.includes("memory/") && !pathLower.startsWith("memory")) {
    return true; // PUBLIC access for non-memory paths
  }

  // ── ALL MEMORY PATHS — DENY-BY-DEFAULT ──────────────────────────────

  // 1. memory/public/ → PUBLIC (anyone can access)
  if (pathLower.includes("memory/public")) {
    return true;
  }

  // 2. memory/core/ → check for shareable artifact sub-dirs
  if (pathLower.includes("memory/core")) {
    if (CORE_PUBLIC_ARTIFACT_DIRS.some((dir) => pathLower.includes(dir))) {
      return true; // PUBLIC access to Ernos's shareable artifacts
    }
    // Everything else under memory/core → CORE only
    return checkScopeAccess(requestScope, PrivacyScope.CORE_PRIVATE);
  }

  // 3. memory/users/{id}/ → PRIVATE with cross-user blocking
  if (pathLower.includes("memory/users")) {
    // Public project/research artifacts are readable from any scope
    if (
      pathLower.includes("/projects/public/") ||
      pathLower.includes("/research/public/") ||
      pathLower.endsWith("/projects/public") ||
      pathLower.endsWith("/research/public")
    ) {
      return true; // PUBLIC access to user's explicitly shared content
    }

    // CROSS-USER ACCESS CHECK: extract target user ID from path
    const pathUserMatch = pathLower.match(/memory\/users\/(\d+)/);
    if (pathUserMatch) {
      const pathUserId = pathUserMatch[1];

      if (userId) {
        // Block cross-user access unless CORE
        if (userId !== pathUserId && requestScope !== PrivacyScope.CORE_PRIVATE) {
          log.warn(
            `CROSS-USER ACCESS BLOCKED: User ${userId} tried to access User ${pathUserId}'s files at "${params.path}"`,
          );
          return false;
        }
      } else {
        // No user ID provided — block all user directories unless CORE
        if (requestScope !== PrivacyScope.CORE_PRIVATE) {
          return false;
        }
      }
    } else {
      // Path is memory/users/ itself (directory listing) — block unless CORE
      if (requestScope !== PrivacyScope.CORE_PRIVATE) {
        log.warn(
          `USER DIRECTORY LISTING BLOCKED: scope=${requestScope} tried to list "${params.path}"`,
        );
        return false;
      }
    }

    return checkScopeAccess(requestScope, PrivacyScope.PRIVATE);
  }

  // 4. ALL OTHER memory/ PATHS → CORE ONLY (deny-by-default)
  // Covers: memory/backups/, memory/cache/, memory/chroma/,
  // memory/system/, memory/debug*, memory/security*, memory/quarantine*
  log.warn(
    `MEMORY PATH BLOCKED (deny-by-default): scope=${requestScope} user=${userId ?? "?"} tried to access "${params.path}"`,
  );
  return checkScopeAccess(requestScope, PrivacyScope.CORE_PRIVATE);
}

/**
 * Get the appropriate write path for a given scope.
 */
export function resolveWritePath(params: {
  scope: PrivacyScopeValue;
  userId?: string;
  baseDir: string;
}): string {
  const { scope, userId, baseDir } = params;

  if (scope === PrivacyScope.CORE_PRIVATE) {
    return `${baseDir}/memory/core`;
  }
  if (scope === PrivacyScope.PRIVATE && userId) {
    return `${baseDir}/memory/users/${userId}`;
  }
  // Default to PUBLIC (safest)
  return `${baseDir}/memory/public`;
}

// ─── Path Normalization ────────────────────────────────────────────────

/**
 * Normalize a file path to prevent traversal attacks.
 * Returns null if the path is malicious.
 */
function normalizePath(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  // 1. Normalize backslashes to forward slashes
  let normalized = input.replaceAll("\\", "/");

  // 2. Percent-decode
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // If decoding fails, use as-is
  }

  // 3. Strip null bytes, newlines, and control characters
  normalized = normalized.replace(/[\x00-\x1f\x7f]/g, "");

  // 4. Resolve ../ traversal
  const parts = normalized.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  normalized = resolved.join("/");

  if (!normalized) {
    return null;
  }

  return normalized;
}
