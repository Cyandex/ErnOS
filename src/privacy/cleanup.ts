/**
 * Privacy Cleanup — Memory/Runtime Data Purge
 *
 * Provides functions to clear session runtime state, user data silos,
 * and stale session artifacts to prevent scope leaks.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("privacy-cleanup");

/**
 * Clear all runtime caches and buffers for a specific session.
 * Call on session end/disconnect to prevent context bleed.
 */
export function clearSessionRuntime(params: {
  sessionKey: string;
  chatRunBuffers?: Map<string, string>;
  chatDeltaSentAt?: Map<string, number>;
  agentRunSeq?: Map<string, number>;
}): void {
  const { sessionKey, chatRunBuffers, chatDeltaSentAt, agentRunSeq } = params;
  const keyLower = sessionKey.trim().toLowerCase();

  let clearedCount = 0;

  // Clear chat run buffers for this session
  if (chatRunBuffers) {
    for (const [key] of chatRunBuffers) {
      if (key.includes(keyLower)) {
        chatRunBuffers.delete(key);
        clearedCount++;
      }
    }
  }

  // Clear delta timestamps
  if (chatDeltaSentAt) {
    for (const [key] of chatDeltaSentAt) {
      if (key.includes(keyLower)) {
        chatDeltaSentAt.delete(key);
        clearedCount++;
      }
    }
  }

  // Clear agent run sequence numbers
  if (agentRunSeq) {
    for (const [key] of agentRunSeq) {
      if (key.includes(keyLower)) {
        agentRunSeq.delete(key);
        clearedCount++;
      }
    }
  }

  if (clearedCount > 0) {
    log.info(`Cleared ${clearedCount} runtime entries for session ${sessionKey}`);
  }
}

/**
 * Wipe a user's entire private data silo.
 * Admin-only operation. Removes all files under memory/users/{userId}/.
 */
export function clearUserData(userId: string, stateDir?: string): { deleted: number } {
  const base = stateDir ?? resolveStateDir();
  const usersDir = path.join(base, "workspace", "memory", "users");
  let deleted = 0;

  if (!fs.existsSync(usersDir)) {
    return { deleted: 0 };
  }

  try {
    const entries = fs.readdirSync(usersDir);
    for (const entry of entries) {
      if (entry.startsWith(userId)) {
        const fullPath = path.join(usersDir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          deleted++;
          log.info(`Deleted user data silo: ${fullPath}`);
        }
      }
    }
  } catch (err) {
    log.warn(`Failed to clear user data for ${userId}: ${String(err)}`);
  }

  return { deleted };
}

/**
 * Clear ALL user data silos, runtime caches, and session data.
 * Nuclear option — use when privacy leak is confirmed.
 */
export function clearAllUserData(stateDir?: string): {
  deletedSilos: number;
  deletedCacheFiles: number;
} {
  const base = stateDir ?? resolveStateDir();
  let deletedSilos = 0;
  let deletedCacheFiles = 0;

  // 1. Clear all user silos
  const usersDir = path.join(base, "workspace", "memory", "users");
  if (fs.existsSync(usersDir)) {
    try {
      fs.rmSync(usersDir, { recursive: true, force: true });
      deletedSilos++;
      log.info("Deleted all user data silos");
    } catch (err) {
      log.warn(`Failed to clear user silos: ${String(err)}`);
    }
  }

  // 2. Clear cache
  const cacheDir = path.join(base, "workspace", "memory", "cache");
  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      deletedCacheFiles++;
      log.info("Deleted memory cache");
    } catch (err) {
      log.warn(`Failed to clear cache: ${String(err)}`);
    }
  }

  // 3. Clear sessions.json
  const sessionsFile = path.join(base, "workspace", "sessions.json");
  if (fs.existsSync(sessionsFile)) {
    try {
      fs.unlinkSync(sessionsFile);
      deletedCacheFiles++;
      log.info("Deleted sessions.json");
    } catch (err) {
      log.warn(`Failed to clear sessions.json: ${String(err)}`);
    }
  }

  return { deletedSilos, deletedCacheFiles };
}

/**
 * Purge stale session data older than maxAgeMs.
 * Garbage collection for expired sessions.
 */
export function purgeStaleSessionData(params: { maxAgeMs: number; stateDir?: string }): {
  purged: number;
} {
  const { maxAgeMs } = params;
  const base = params.stateDir ?? resolveStateDir();
  const sessionsDir = path.join(base, "workspace");
  let purged = 0;
  const now = Date.now();

  // Scan for .jsonl session files that are too old
  try {
    if (fs.existsSync(sessionsDir)) {
      const entries = fs.readdirSync(sessionsDir);
      for (const entry of entries) {
        if (entry.endsWith(".jsonl")) {
          const fullPath = path.join(sessionsDir, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > maxAgeMs) {
              fs.unlinkSync(fullPath);
              purged++;
            }
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch (err) {
    log.warn(`Failed to purge stale sessions: ${String(err)}`);
  }

  if (purged > 0) {
    log.info(`Purged ${purged} stale session files`);
  }

  return { purged };
}
