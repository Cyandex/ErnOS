/**
 * Error Ring Buffer — captures recent errors for HUD display.
 *
 * Hooks into logError() to maintain an in-memory ring buffer
 * of the last N errors so the HUD can show them.
 */

const MAX_ERRORS = 20;
const errorBuffer: string[] = [];

/**
 * Push an error message into the ring buffer.
 * Called from logError() in logger.ts.
 */
export function pushError(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const entry = `[${timestamp}] ${message.slice(0, 200)}`;
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.shift();
  }
}

/**
 * Get recent errors for HUD display.
 * Returns the last N errors, most recent last.
 */
export function getRecentErrors(limit = 10): string[] {
  return errorBuffer.slice(-limit);
}

/** Reset buffer (for testing). */
export function _resetErrorBuffer(): void {
  errorBuffer.length = 0;
}
