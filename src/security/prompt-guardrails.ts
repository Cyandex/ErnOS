/**
 * Prompt output guardrails for LLM-generated tool calls.
 *
 * After the LLM produces a tool call, scan the arguments against a blocklist
 * of dangerous patterns. This prevents the LLM from being tricked via prompt
 * injection into executing destructive commands the user never asked for.
 *
 * IMPORTANT: These guardrails do NOT prevent the user from explicitly
 * requesting dangerous operations. They only block LLM-hallucinated
 * commands that target sensitive paths or protocols.
 *
 * @see Security Report: Prompt Injection Defense
 */

export type GuardrailResult = {
  blocked: boolean;
  reason?: string;
  matchedPattern?: string;
};

// ---------------------------------------------------------------------------
// Dangerous command patterns for system.run / exec tools
// ---------------------------------------------------------------------------

const DANGEROUS_EXEC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|\s|;|&&|\|)rm\s+-[^\s]*r[^\s]*f/i,
    reason: "Recursive force-delete detected",
  },
  {
    pattern: /~\/\.ssh\/|\/\.ssh\//,
    reason: "Targets SSH credential directory",
  },
  {
    pattern: /~\/\.gnupg\/|\/\.gnupg\//,
    reason: "Targets GPG keyring directory",
  },
  {
    pattern: /~\/\.aws\/|\/\.aws\/credentials/,
    reason: "Targets AWS credentials",
  },
  {
    pattern: /\/etc\/shadow|\/etc\/passwd/,
    reason: "Targets system credential files",
  },
  {
    pattern: /curl\s+.*\|\s*(?:bash|sh|zsh)|wget\s+.*\|\s*(?:bash|sh|zsh)/i,
    reason: "Pipe-to-shell execution detected",
  },
  {
    pattern: /crontab\s+-[^\s]*[re]/,
    reason: "Crontab modification detected",
  },
  {
    pattern: /authorized_keys/,
    reason: "SSH authorized_keys modification detected",
  },
  {
    pattern: /systemctl\s+(enable|start)\s/i,
    reason: "Systemd service persistence detected",
  },
  {
    pattern: /launchctl\s+load/i,
    reason: "macOS LaunchAgent persistence detected",
  },
  {
    pattern: /mkfs\s/i,
    reason: "Filesystem format command detected",
  },
  {
    pattern: /dd\s+.*of=\/dev\//i,
    reason: "Raw disk write detected",
  },
];

// ---------------------------------------------------------------------------
// Dangerous URL patterns for browser / fetch tools
// ---------------------------------------------------------------------------

const DANGEROUS_URL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^file:\/\//i,
    reason: "file:// URI blocked (local file access)",
  },
  {
    pattern: /^javascript:/i,
    reason: "javascript: URI blocked (XSS vector)",
  },
  {
    pattern: /^data:text\/html/i,
    reason: "data:text/html URI blocked (XSS vector)",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check a system.run / exec tool call for dangerous patterns.
 * Returns blocked=true if the command matches a known dangerous pattern.
 */
export function checkExecCommand(command: string): GuardrailResult {
  for (const entry of DANGEROUS_EXEC_PATTERNS) {
    if (entry.pattern.test(command)) {
      return {
        blocked: true,
        reason: entry.reason,
        matchedPattern: entry.pattern.source,
      };
    }
  }
  return { blocked: false };
}

/**
 * Check a browser.navigate / fetch URL for dangerous patterns.
 */
export function checkNavigateUrl(url: string): GuardrailResult {
  for (const entry of DANGEROUS_URL_PATTERNS) {
    if (entry.pattern.test(url)) {
      return {
        blocked: true,
        reason: entry.reason,
        matchedPattern: entry.pattern.source,
      };
    }
  }
  return { blocked: false };
}

/**
 * Generate a canary token for embedding in system prompts.
 * The token should be checked for in the LLM response. If the LLM
 * echoes the canary, it likely leaked its system prompt.
 */
export function generateCanaryToken(): string {
  const chars = "abcdef0123456789";
  let token = "CANARY-";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Check if an LLM response contains a canary token leak.
 */
export function detectCanaryLeak(response: string, canaryToken: string): boolean {
  return response.includes(canaryToken);
}
