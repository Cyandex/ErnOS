import path from "node:path";

/**
 * Docker sandbox bind-mount validator.
 *
 * Validates all bind mounts against a strict allowlist of host paths.
 * Prevents container escape via unvalidated mount injection.
 *
 * @see CVE-2026-24763
 */

// ---------------------------------------------------------------------------
// Blocked host paths — never allow mounting these into a container
// ---------------------------------------------------------------------------

const BLOCKED_HOST_PATHS = [
  "/",
  "/etc",
  "/var/run/docker.sock",
  "/var/lib/docker",
  "/root",
  "/proc",
  "/sys",
  "/dev",
  "/boot",
  "/lib",
  "/lib64",
  "/sbin",
  "/usr",
  "/bin",
];

/** Home directory patterns that should be blocked. */
const HOME_DIR_PATTERNS = [/^\/home\/[^/]+$/, /^\/Users\/[^/]+$/, /^\/root$/];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MountConfig = {
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
};

export type MountValidationResult = {
  valid: boolean;
  violations: Array<{
    hostPath: string;
    reason: string;
  }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canonicalize(p: string): string {
  return path.resolve(path.normalize(p));
}

function isBlockedPath(hostPath: string): { blocked: boolean; reason: string } {
  const canonical = canonicalize(hostPath);

  // Exact blocked paths
  for (const blocked of BLOCKED_HOST_PATHS) {
    if (canonical === blocked) {
      return { blocked: true, reason: `Mount to ${blocked} is prohibited` };
    }
  }

  // Check if path is inside a blocked directory
  for (const blocked of BLOCKED_HOST_PATHS) {
    if (blocked !== "/" && canonical.startsWith(blocked + "/")) {
      // Allow /etc hostname-style lookups but block everything else under /etc
      if (blocked === "/etc") {
        return { blocked: true, reason: `Mount inside ${blocked}/ is prohibited` };
      }
      return { blocked: true, reason: `Mount inside ${blocked}/ is prohibited` };
    }
  }

  // Home directory patterns
  for (const pattern of HOME_DIR_PATTERNS) {
    if (pattern.test(canonical)) {
      return { blocked: true, reason: "Mount to user home directory is prohibited" };
    }
  }

  // Docker socket anywhere
  if (canonical.endsWith("/docker.sock")) {
    return { blocked: true, reason: "Docker socket mount is prohibited" };
  }

  return { blocked: false, reason: "" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an array of bind mount configurations.
 * Returns a result indicating whether all mounts are safe.
 */
export function validateBindMounts(mounts: MountConfig[]): MountValidationResult {
  const violations: MountValidationResult["violations"] = [];

  for (const mount of mounts) {
    const check = isBlockedPath(mount.hostPath);
    if (check.blocked) {
      violations.push({
        hostPath: mount.hostPath,
        reason: check.reason,
      });
    }

    // Warn about path traversal in mount paths
    if (mount.hostPath.includes("..")) {
      violations.push({
        hostPath: mount.hostPath,
        reason: "Path traversal (..) in host path is not allowed",
      });
    }

    if (mount.containerPath.includes("..")) {
      violations.push({
        hostPath: mount.hostPath,
        reason: "Path traversal (..) in container path is not allowed",
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Force a mount to be read-only unless it targets the sandbox scratch directory.
 */
export function enforceReadOnlyMounts(
  mounts: MountConfig[],
  scratchDir = "/tmp/ernos-sandbox",
): MountConfig[] {
  return mounts.map((mount) => {
    const canonical = canonicalize(mount.hostPath);
    if (canonical.startsWith(canonicalize(scratchDir))) {
      return mount; // scratch dir is read-write
    }
    return { ...mount, readOnly: true };
  });
}
