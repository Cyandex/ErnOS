import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * SSRF prevention filter for outbound HTTP/WebSocket requests.
 *
 * Before any agent-initiated outbound request, resolve the target hostname
 * and block requests to private/reserved IP ranges. This prevents the agent
 * from being tricked into scanning or attacking internal network services.
 *
 * @see CVE-2026-26322, GHSA-56f2-hvwg-5743, GHSA-pg2v-8xwh-qhcc
 */

// ---------------------------------------------------------------------------
// Private / reserved CIDR ranges (IPv4 + IPv6)
// ---------------------------------------------------------------------------

const BLOCKED_CIDRS_V4 = [
  { prefix: "10.0.0.0", mask: 8 },
  { prefix: "172.16.0.0", mask: 12 },
  { prefix: "192.168.0.0", mask: 16 },
  { prefix: "127.0.0.0", mask: 8 },
  { prefix: "169.254.0.0", mask: 16 },
  { prefix: "0.0.0.0", mask: 8 },
  { prefix: "100.64.0.0", mask: 10 }, // CGNAT / Tailscale
  { prefix: "192.0.0.0", mask: 24 }, // IETF protocol assignments
  { prefix: "192.0.2.0", mask: 24 }, // documentation
  { prefix: "198.51.100.0", mask: 24 }, // documentation
  { prefix: "203.0.113.0", mask: 24 }, // documentation
  { prefix: "224.0.0.0", mask: 4 }, // multicast
  { prefix: "240.0.0.0", mask: 4 }, // reserved
];

const BLOCKED_CIDRS_V6 = [
  { prefix: "::1", mask: 128 }, // loopback
  { prefix: "fc00::", mask: 7 }, // unique local
  { prefix: "fe80::", mask: 10 }, // link-local
  { prefix: "ff00::", mask: 8 }, // multicast
  { prefix: "::", mask: 128 }, // unspecified
  { prefix: "::ffff:0:0", mask: 96 }, // IPv4-mapped (checked via v4 rules after extraction)
];

// ---------------------------------------------------------------------------
// IP parsing helpers
// ---------------------------------------------------------------------------

function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isInCidrV4(ip: string, prefix: string, mask: number): boolean {
  const ipLong = ipToLong(ip);
  const prefixLong = ipToLong(prefix);
  const maskBits = (~0 << (32 - mask)) >>> 0;
  return (ipLong & maskBits) === (prefixLong & maskBits);
}

function expandIPv6(ip: string): string {
  let groups = ip.split(":");
  const doubleColonIndex = groups.indexOf("");
  if (doubleColonIndex !== -1) {
    const before = groups.slice(0, doubleColonIndex);
    const after = groups.slice(doubleColonIndex + 1).filter((g) => g !== "");
    const missing = 8 - before.length - after.length;
    groups = [...before, ...Array(missing).fill("0"), ...after];
  }
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

function ipv6ToBigInt(ip: string): bigint {
  const expanded = expandIPv6(ip);
  const hex = expanded.replace(/:/g, "");
  return BigInt("0x" + hex);
}

function isInCidrV6(ip: string, prefix: string, mask: number): boolean {
  const ipBig = ipv6ToBigInt(ip);
  const prefixBig = ipv6ToBigInt(prefix);
  const shift = BigInt(128 - mask);
  return ipBig >> shift === prefixBig >> shift;
}

// ---------------------------------------------------------------------------
// Core filter
// ---------------------------------------------------------------------------

export type EgressFilterConfig = {
  /** If true, block requests to private/reserved IP ranges (default: true). */
  blockPrivateIPs?: boolean;
  /** Explicit allowlist of internal hosts that the agent is permitted to reach. */
  allowedInternalHosts?: string[];
};

export type EgressCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; resolvedIP: string };

/**
 * Check if an outbound request target is allowed.
 *
 * Resolves the hostname to an IP, then checks against blocked ranges.
 * Public internet hosts always pass. Internal hosts are blocked unless
 * they appear in the allowedInternalHosts list.
 */
export async function checkEgressTarget(
  targetUrl: string,
  config?: EgressFilterConfig,
): Promise<EgressCheckResult> {
  const blockPrivateIPs = config?.blockPrivateIPs ?? true;
  if (!blockPrivateIPs) {
    return { allowed: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: "invalid_url", resolvedIP: "" };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Check allowlist first (exact hostname match).
  const allowedHosts = config?.allowedInternalHosts ?? [];
  if (allowedHosts.some((h) => h.toLowerCase() === hostname.toLowerCase())) {
    return { allowed: true };
  }

  // If the hostname is already an IP, check directly.
  if (net.isIP(hostname)) {
    return checkIP(hostname);
  }

  // Resolve hostname to IP.
  try {
    const result = await lookup(hostname, { family: 0 });
    return checkIP(result.address);
  } catch {
    // DNS failure — allow by default to avoid breaking legitimate requests.
    return { allowed: true };
  }
}

function checkIP(ip: string): EgressCheckResult {
  const version = net.isIP(ip);

  if (version === 4) {
    for (const cidr of BLOCKED_CIDRS_V4) {
      if (isInCidrV4(ip, cidr.prefix, cidr.mask)) {
        return {
          allowed: false,
          reason: `blocked_private_ip (${cidr.prefix}/${cidr.mask})`,
          resolvedIP: ip,
        };
      }
    }
    return { allowed: true };
  }

  if (version === 6) {
    // Check for IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
    const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (v4Mapped) {
      return checkIP(v4Mapped[1]);
    }

    for (const cidr of BLOCKED_CIDRS_V6) {
      if (isInCidrV6(ip, cidr.prefix, cidr.mask)) {
        return {
          allowed: false,
          reason: `blocked_private_ip (${cidr.prefix}/${cidr.mask})`,
          resolvedIP: ip,
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "invalid_ip", resolvedIP: ip };
}
