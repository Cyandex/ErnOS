import { randomBytes } from "node:crypto";

/**
 * Generate a per-request CSP nonce for inline scripts.
 */
export function generateCspNonce(): string {
  return randomBytes(16).toString("base64");
}

export function buildControlUiCspHeader(nonce?: string): string {
  const scriptSrc = nonce ? `script-src 'nonce-${nonce}'` : "script-src 'self'";

  // Control UI: block framing, block inline scripts, keep styles permissive
  // (UI uses a lot of inline style attributes in templates).
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
  ].join("; ");
}
