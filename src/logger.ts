import { danger, info, logVerboseConsole, success, warn } from "./globals.js";
import { pushError } from "./logging/error-buffer.js";
import { getLogger } from "./logging/logger.js";
import { createSubsystemLogger } from "./logging/subsystem.js";
import { defaultRuntime, type RuntimeEnv } from "./runtime.js";

const subsystemPrefixRe = /^([a-z][a-z0-9-]{1,20}):\s+(.*)$/i;

// ---------------------------------------------------------------------------
// Credential auto-redaction filter (Fix 10)
// ---------------------------------------------------------------------------

/** Patterns matching common API key / token / JWT formats. */
const SECRET_PATTERNS = [
  /\bsk-[a-zA-Z0-9]{20,}\b/g, // OpenAI-style keys
  /\bxoxb-[a-zA-Z0-9-]{20,}\b/g, // Slack bot tokens
  /\bxoxp-[a-zA-Z0-9-]{20,}\b/g, // Slack user tokens
  /\bBot\s+[A-Za-z0-9._-]{40,}\b/g, // Discord bot tokens
  /\bghp_[a-zA-Z0-9]{36}\b/g, // GitHub personal tokens
  /\bghs_[a-zA-Z0-9]{36}\b/g, // GitHub server tokens
  /\bAIza[a-zA-Z0-9_-]{35}\b/g, // Google API keys
  /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/g, // JWTs
  /\bERNOS_GATEWAY_TOKEN=[^\s'"]+/gi, // ErnOS tokens in env dumps
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s'"]{8,}/gi, // Generic key=value patterns
];

/**
 * Redact secrets from a log message. Replaces detected patterns with [REDACTED].
 */
export function redactSecrets(message: string): string {
  let redacted = message;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns.
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// Logger functions
// ---------------------------------------------------------------------------

function splitSubsystem(message: string) {
  const match = message.match(subsystemPrefixRe);
  if (!match) {
    return null;
  }
  const [, subsystem, rest] = match;
  return { subsystem, rest };
}

export function logInfo(message: string, runtime: RuntimeEnv = defaultRuntime) {
  const safe = redactSecrets(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safe) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).info(parsed.rest);
    return;
  }
  runtime.log(info(safe));
  getLogger().info(safe);
}

export function logWarn(message: string, runtime: RuntimeEnv = defaultRuntime) {
  const safe = redactSecrets(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safe) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).warn(parsed.rest);
    return;
  }
  runtime.log(warn(safe));
  getLogger().warn(safe);
}

export function logSuccess(message: string, runtime: RuntimeEnv = defaultRuntime) {
  const safe = redactSecrets(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safe) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).info(parsed.rest);
    return;
  }
  runtime.log(success(safe));
  getLogger().info(safe);
}

export function logError(message: string, runtime: RuntimeEnv = defaultRuntime) {
  const safe = redactSecrets(message);
  pushError(safe);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safe) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).error(parsed.rest);
    return;
  }
  runtime.error(danger(safe));
  getLogger().error(safe);
}

export function logDebug(message: string) {
  const safe = redactSecrets(message);
  // Always emit to file logger (level-filtered); console only when verbose.
  getLogger().debug(safe);
  logVerboseConsole(safe);
}
