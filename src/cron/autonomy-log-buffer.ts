/**
 * Autonomy Log Buffer — captures recent autonomous thoughts for HUD display.
 *
 * The autonomy daemon broadcasts thoughts via WS events but doesn't persist them.
 * This ring buffer catches them for HUD injection.
 */

const MAX_THOUGHTS = 15;
const thoughtBuffer: string[] = [];

/**
 * Push an autonomous thought into the buffer.
 * Called from the autonomy daemon's onThought callback.
 */
export function pushThought(thought: string): void {
  const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const entry = `[${timestamp}] ${thought.slice(0, 200)}`;
  thoughtBuffer.push(entry);
  if (thoughtBuffer.length > MAX_THOUGHTS) {
    thoughtBuffer.shift();
  }
}

/**
 * Get recent autonomous thoughts for HUD display.
 */
export function getRecentThoughts(limit = 10): string[] {
  return thoughtBuffer.slice(-limit);
}

/** Reset buffer (for testing). */
export function _resetThoughtBuffer(): void {
  thoughtBuffer.length = 0;
}
