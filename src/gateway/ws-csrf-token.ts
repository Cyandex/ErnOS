import { randomBytes } from "node:crypto";

/**
 * Per-session CSRF nonce for WebSocket connections.
 *
 * Prevents Cross-Site WebSocket Hijacking (CSWSH) by requiring the first
 * WS message to echo a server-generated nonce. Even if an attacker bypasses
 * the Origin check, they cannot obtain this nonce without same-origin access.
 *
 * @see CVE-2026-25253
 */

// ---------------------------------------------------------------------------
// Nonce store (in-memory, keyed by WS connection ID)
// ---------------------------------------------------------------------------

const pendingNonces = new Map<string, { nonce: string; expiresAt: number }>();

/** How long a nonce remains valid before the client must echo it (ms). */
const NONCE_TTL_MS = 30_000;

/** Periodic cleanup interval (ms). */
const CLEANUP_INTERVAL_MS = 60_000;

// Background sweeper for expired nonces.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pendingNonces) {
    if (entry.expiresAt <= now) {
      pendingNonces.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CSRF nonce for a new WebSocket connection.
 * The nonce is stored server-side and must be echoed back by the client
 * in its first WS message as `{ csrfNonce: "<value>" }`.
 */
export function generateCsrfNonce(connectionId: string): string {
  const nonce = randomBytes(32).toString("hex");
  pendingNonces.set(connectionId, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

/**
 * Validate and consume the CSRF nonce for a connection.
 * Returns true if the nonce matches and has not expired.
 * The nonce is consumed (deleted) on successful validation.
 */
export function validateCsrfNonce(connectionId: string, clientNonce: string): boolean {
  const entry = pendingNonces.get(connectionId);
  if (!entry) {
    return false;
  }

  // Always delete after first attempt — one shot only.
  pendingNonces.delete(connectionId);

  if (Date.now() > entry.expiresAt) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks.
  if (entry.nonce.length !== clientNonce.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < entry.nonce.length; i++) {
    mismatch |= entry.nonce.charCodeAt(i) ^ clientNonce.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Remove a pending nonce (e.g., when a connection is closed before validation).
 */
export function removePendingNonce(connectionId: string): void {
  pendingNonces.delete(connectionId);
}

/**
 * For testing: returns the number of pending nonces.
 */
export function __getPendingNonceCountForTest(): number {
  return pendingNonces.size;
}
