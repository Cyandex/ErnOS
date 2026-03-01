import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import type { ErnOSConfig } from "../../config/config.js";

export type OutboundSessionContext = {
  /** Canonical session key used for internal hook dispatch. */
  key?: string;
  /** Active agent id used for workspace-scoped media roots. */
  agentId?: string;
  /** Five-tier cognitive memory context for this session. */
  memoryStoreContext?: Record<string, any>;
};

function normalizeOptionalString(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildOutboundSessionContext(params: {
  cfg: ErnOSConfig;
  sessionKey?: string | null;
  agentId?: string | null;
  memoryStoreContext?: Record<string, any>;
}): OutboundSessionContext | undefined {
  const key = normalizeOptionalString(params.sessionKey);
  const explicitAgentId = normalizeOptionalString(params.agentId);
  const derivedAgentId = key
    ? resolveSessionAgentId({ sessionKey: key, config: params.cfg })
    : undefined;
  const agentId = explicitAgentId ?? derivedAgentId;
  const memCtx = params.memoryStoreContext;
  if (!key && !agentId && !memCtx) {
    return undefined;
  }
  return {
    ...(key ? { key } : {}),
    ...(agentId ? { agentId } : {}),
    ...(memCtx ? { memoryStoreContext: memCtx } : {}),
  };
}
