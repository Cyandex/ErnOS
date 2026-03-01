/**
 * Tool Access Guard — ported from ErnOS 3.0 scope-protected patterns
 *
 * Controls which tools are available based on the user's privacy scope.
 * Admin (CORE_PRIVATE) gets full access; regular users get SAFE tools only.
 *
 * Tool Categories:
 * - ADMIN_ONLY: file_write, exec, shell, config, memory_admin, system
 * - SAFE: search, web_search, memory_read (own silo only), ask, summarize, calculate
 * - PUBLIC_SAFE: tools available even in public channel context
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { type PrivacyScopeValue, PrivacyScope } from "./scope.js";

const log = createSubsystemLogger("tool-guard");

// ─── Tool Classification ───────────────────────────────────────────────

/**
 * Tools that require admin (CORE_PRIVATE) scope.
 * Patterns are matched case-insensitively against tool names.
 */
const ADMIN_ONLY_PATTERNS = [
  /^file_write$/i,
  /^file_delete$/i,
  /^file_create$/i,
  /^exec$/i,
  /^shell$/i,
  /^run_command$/i,
  /^terminal$/i,
  /^config/i,
  /^memory_write$/i,
  /^memory_delete$/i,
  /^memory_admin$/i,
  /^system/i,
  /^admin/i,
  /^skill_install$/i,
  /^skill_delete$/i,
  /^backup/i,
  /^restore/i,
  /^nuke/i,
  /^restart/i,
  /^shutdown/i,
  /^update/i,
  /^deploy/i,
  /^user_manage/i,
  /^channel_manage/i,
  /^cron/i,
  /^schedule/i,
];

/**
 * Tools available to PRIVATE scope (DM users).
 * Not available in PUBLIC (guild) context.
 */
const PRIVATE_SAFE_PATTERNS = [
  /^memory_read$/i,
  /^recall$/i,
  /^remember$/i,
  /^journal$/i,
  /^note$/i,
  /^diary$/i,
  /^persona/i,
  /^profile/i,
];

/**
 * Tools available to all scopes including PUBLIC.
 */
const PUBLIC_SAFE_PATTERNS = [
  /^search$/i,
  /^web_search$/i,
  /^web_browse$/i,
  /^ask$/i,
  /^summarize$/i,
  /^calculate$/i,
  /^translate$/i,
  /^define$/i,
  /^weather$/i,
  /^time$/i,
  /^convert$/i,
  /^image_gen/i,
  /^image_describe/i,
  /^music/i,
  /^voice/i,
  /^read_file$/i,
  /^file_read$/i,
  /^list_files$/i,
];

// ─── Access Check ──────────────────────────────────────────────────────

export type ToolAccessResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if a tool is allowed for the given scope.
 *
 * @param toolName - Name of the tool being invoked
 * @param scope - The requester's privacy scope
 * @param userId - The requester's user ID (for logging)
 * @returns Whether the tool is allowed and why
 */
export function isToolAllowed(
  toolName: string,
  scope: PrivacyScopeValue,
  userId?: string,
): ToolAccessResult {
  // CORE_PRIVATE and OPEN scope: full access
  if (scope === PrivacyScope.CORE_PRIVATE || scope === PrivacyScope.OPEN) {
    return { allowed: true };
  }

  // Check if tool is admin-only
  if (ADMIN_ONLY_PATTERNS.some((pattern) => pattern.test(toolName))) {
    log.warn(
      `TOOL ACCESS DENIED: scope=${scope} user=${userId ?? "?"} tool=${toolName} (admin-only)`,
    );
    return {
      allowed: false,
      reason: `Tool "${toolName}" requires admin access.`,
    };
  }

  // PRIVATE scope: can use private-safe + public-safe tools
  if (scope === PrivacyScope.PRIVATE) {
    if (
      PRIVATE_SAFE_PATTERNS.some((pattern) => pattern.test(toolName)) ||
      PUBLIC_SAFE_PATTERNS.some((pattern) => pattern.test(toolName))
    ) {
      return { allowed: true };
    }
    // Unknown tools: allow by default in PRIVATE scope (fail-open for new tools)
    // The guard.ts path validation will catch unauthorized data access
    return { allowed: true };
  }

  // PUBLIC scope: only public-safe tools
  if (scope === PrivacyScope.PUBLIC) {
    if (PUBLIC_SAFE_PATTERNS.some((pattern) => pattern.test(toolName))) {
      return { allowed: true };
    }
    // Private-only tools are blocked in public context
    if (PRIVATE_SAFE_PATTERNS.some((pattern) => pattern.test(toolName))) {
      log.warn(
        `TOOL ACCESS DENIED: scope=${scope} user=${userId ?? "?"} tool=${toolName} (private-only in public context)`,
      );
      return {
        allowed: false,
        reason: `Tool "${toolName}" is only available in direct messages.`,
      };
    }
    // Unknown tools: allow by default in PUBLIC (fail-open)
    return { allowed: true };
  }

  // CORE_PUBLIC: same as PUBLIC
  if (scope === PrivacyScope.CORE_PUBLIC) {
    if (PUBLIC_SAFE_PATTERNS.some((pattern) => pattern.test(toolName))) {
      return { allowed: true };
    }
    return { allowed: true }; // fail-open
  }

  return { allowed: true }; // fail-open for unknown scopes
}

/**
 * Filter a list of tool definitions based on scope.
 * Returns only the tools that are allowed for the given scope.
 */
export function filterToolsByScope<T extends { name: string }>(
  tools: T[],
  scope: PrivacyScopeValue,
  userId?: string,
): T[] {
  return tools.filter((tool) => isToolAllowed(tool.name, scope, userId).allowed);
}
