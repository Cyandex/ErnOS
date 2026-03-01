import { isLoopbackHost, normalizeHostHeader, resolveHostName } from "./net.js";

type OriginCheckResult = { ok: true } | { ok: false; reason: string };

function parseOrigin(
  originRaw?: string,
): { origin: string; host: string; hostname: string } | null {
  const trimmed = (originRaw ?? "").trim();
  if (!trimmed || trimmed === "null") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return {
      origin: url.origin.toLowerCase(),
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function checkBrowserOrigin(params: {
  requestHost?: string;
  origin?: string;
  allowedOrigins?: string[];
  allowHostHeaderOriginFallback?: boolean;
  /** Gateway's own port — loopback origins are only trusted when their port matches. */
  gatewayPort?: number;
}): OriginCheckResult {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    return { ok: false, reason: "origin missing or invalid" };
  }

  const allowlist = (params.allowedOrigins ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(parsedOrigin.origin)) {
    return { ok: true };
  }

  const requestHost = normalizeHostHeader(params.requestHost);
  if (
    params.allowHostHeaderOriginFallback === true &&
    requestHost &&
    parsedOrigin.host === requestHost
  ) {
    return { ok: true };
  }

  // HARDENED: Only trust loopback origins whose port matches the gateway's own port.
  // This prevents CSWSH from malicious pages running on other localhost ports.
  const requestHostname = resolveHostName(requestHost);
  if (isLoopbackHost(parsedOrigin.hostname) && isLoopbackHost(requestHostname)) {
    if (params.gatewayPort != null) {
      const originPort = extractPort(parsedOrigin.origin);
      if (originPort != null && originPort !== params.gatewayPort) {
        return { ok: false, reason: "loopback origin port mismatch" };
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: "origin not allowed" };
}

/** Extract port number from an origin string like "http://localhost:18789". */
function extractPort(origin: string): number | null {
  try {
    const url = new URL(origin);
    if (url.port) {
      return parseInt(url.port, 10);
    }
    // Default ports
    if (url.protocol === "https:" || url.protocol === "wss:") return 443;
    if (url.protocol === "http:" || url.protocol === "ws:") return 80;
    return null;
  } catch {
    return null;
  }
}
