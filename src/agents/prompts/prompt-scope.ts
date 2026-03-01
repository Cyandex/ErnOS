/**
 * Prompt Scope Utilities — adapted from V3 manager.py
 *
 * Scope-aware prompt selection: determines which identity, HUD template,
 * and observer configuration to use based on the interaction context.
 *
 * Now wired to the real PrivacyScope engine (src/privacy/scope.ts).
 */

import {
  type PrivacyScopeValue,
  PrivacyScope,
  resolveScope,
  extractUserIdFromSessionKey,
} from "../../privacy/scope.js";

// Re-export for backward compatibility
export type PromptScope = "PUBLIC" | "PRIVATE" | "CORE";
export type InteractionMode = "default" | "professional";

export interface PromptScopeContext {
  scope: PromptScope;
  privacyScope?: PrivacyScopeValue;
  userId?: string;
  personaName?: string;
  interactionMode?: InteractionMode;
  isGroupChat?: boolean;
  channelType?: string;
  sessionKey?: string;
}

/**
 * Convert a session key into a full PromptScopeContext.
 */
export function buildPromptScopeContext(params: {
  sessionKey?: string;
  isDm?: boolean;
  personaName?: string;
  interactionMode?: InteractionMode;
  isGroupChat?: boolean;
  channelType?: string;
}): PromptScopeContext {
  const privacyScope = resolveScope({
    sessionKey: params.sessionKey,
    isDm: params.isDm,
  });

  // Map PrivacyScope to legacy PromptScope
  let scope: PromptScope;
  if (privacyScope === PrivacyScope.CORE_PRIVATE) {
    scope = "CORE";
  } else if (privacyScope === PrivacyScope.PRIVATE) {
    scope = "PRIVATE";
  } else {
    scope = "PUBLIC";
  }

  return {
    scope,
    privacyScope,
    userId: extractUserIdFromSessionKey(params.sessionKey),
    personaName: params.personaName,
    interactionMode: params.interactionMode,
    isGroupChat: params.isGroupChat,
    channelType: params.channelType,
    sessionKey: params.sessionKey,
  };
}

/**
 * Determines the identity variant to load based on scope and context.
 *
 * Resolution order (from V3 manager.py):
 * 1. If personaName is set → load persona identity
 * 2. If PRIVATE scope + user has custom identity → load user identity
 * 3. If PRIVATE scope + professional mode → professional identity
 * 4. Otherwise → core Ernos identity
 */
export function resolveIdentityForScope(
  ctx: PromptScopeContext,
): "core" | "professional" | "persona" | "user-custom" {
  if (ctx.personaName) {
    return "persona";
  }
  if (ctx.scope === "PRIVATE") {
    // In V4, user-custom identities aren't implemented yet — default to core
    if (ctx.interactionMode === "professional") {
      return "professional";
    }
  }
  return "core";
}

/**
 * Determines the HUD variant to use based on scope.
 *
 * - Persona or custom identity → Fork HUD (per-user, relationship-focused)
 * - Default Ernos → Full HUD (system-wide context)
 */
export function resolveHudForScope(ctx: PromptScopeContext): "full" | "fork" {
  if (ctx.personaName) {
    return "fork";
  }
  if (ctx.scope === "PRIVATE" && ctx.userId) {
    return "fork";
  }
  return "full";
}

/**
 * Determines the observer audit level based on scope.
 * CORE scope gets the most rigorous auditing.
 */
export function resolveObserverLevel(ctx: PromptScopeContext): "full" | "standard" | "minimal" {
  if (ctx.scope === "CORE") {
    return "full";
  }
  if (ctx.scope === "PRIVATE") {
    return "standard";
  }
  return "standard";
}
