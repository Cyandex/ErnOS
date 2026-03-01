/**
 * Social Graph Layer — Mycelium Network.
 *
 * Maps user-to-user connections observed through conversation.
 * Tracks who mentions whom, shared channels, and connection strength.
 * JSON-backed with optional KG enrichment.
 *
 * Ported from V3's `memory/social_graph.py` (6.8K).
 */

import * as fs from "fs";
import * as path from "path";

interface SocialNode {
  userId: string;
  firstSeen: string;
  mentionCount: number;
}

interface SocialEdge {
  from: string;
  to: string;
  type: string;
  channel: string;
  context: string;
  timestamp: string;
}

interface GroupData {
  channelId: string;
  members: string[];
  activityCount: number;
}

interface SocialGraphData {
  nodes: Record<string, SocialNode>;
  edges: SocialEdge[];
  groups: Record<string, GroupData>;
}

const DATA_DIR = path.join(process.cwd(), "memory", "system");
const GRAPH_FILE = path.join(DATA_DIR, "social_graph.json");
const MAX_EDGES = 5000;
const TRIM_TO = 3000;

export class SocialGraphManager {
  private data: SocialGraphData;

  constructor() {
    this.data = this.load();
  }

  private load(): SocialGraphData {
    try {
      if (fs.existsSync(GRAPH_FILE)) {
        return JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
      }
    } catch (e) {
      console.warn("[SocialGraph] Failed to load:", e);
    }
    return { nodes: {}, edges: [], groups: {} };
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR, { recursive: true });}
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.warn("[SocialGraph] Failed to save:", e);
    }
  }

  // ─── Observation Recording ───────────────────────────────────────────

  /**
   * Record that fromUser mentioned mentionedUser in conversation.
   * Builds the social graph edge by edge.
   */
  public recordMention(
    fromUser: string,
    mentionedUser: string,
    channelId: string,
    context: string = "",
  ): void {
    // Ensure nodes exist
    if (!this.data.nodes[fromUser]) {
      this.data.nodes[fromUser] = {
        userId: fromUser,
        firstSeen: new Date().toISOString(),
        mentionCount: 0,
      };
    }
    if (!this.data.nodes[mentionedUser]) {
      this.data.nodes[mentionedUser] = {
        userId: mentionedUser,
        firstSeen: new Date().toISOString(),
        mentionCount: 0,
      };
    }

    this.data.nodes[fromUser].mentionCount++;

    this.data.edges.push({
      from: fromUser,
      to: mentionedUser,
      type: "mentioned",
      channel: channelId,
      context: context.slice(0, 500),
      timestamp: new Date().toISOString(),
    });

    // Cap edges
    if (this.data.edges.length > MAX_EDGES) {
      this.data.edges = this.data.edges.slice(-TRIM_TO);
    }

    this.save();
  }

  /**
   * Record co-occurrence: multiple users active in the same channel.
   * Infers group membership and connection strength.
   */
  public recordCoOccurrence(userIds: string[], channelId: string): void {
    if (!this.data.groups[channelId]) {
      this.data.groups[channelId] = {
        channelId,
        members: [],
        activityCount: 0,
      };
    }

    const group = this.data.groups[channelId];
    for (const uid of userIds) {
      if (!group.members.includes(uid)) {group.members.push(uid);}
    }
    group.activityCount++;
    this.save();
  }

  // ─── Queries ─────────────────────────────────────────────────────────

  /** Get all users connected to a given user, sorted by mention frequency. */
  public getConnections(userId: string): Array<{
    userId: string;
    mentionCount: number;
    lastSeen: string;
  }> {
    const connections = new Map<string, { userId: string; mentionCount: number; lastSeen: string }>();

    for (const edge of this.data.edges) {
      let other: string | null = null;
      if (edge.from === userId) {other = edge.to;}
      else if (edge.to === userId) {other = edge.from;}

      if (other) {
        const existing = connections.get(other) ?? {
          userId: other,
          mentionCount: 0,
          lastSeen: edge.timestamp,
        };
        existing.mentionCount++;
        existing.lastSeen = edge.timestamp;
        connections.set(other, existing);
      }
    }

    return [...connections.values()]
      .toSorted((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 20);
  }

  /** Get channels where both users are active. */
  public getSharedGroups(userA: string, userB: string): string[] {
    const shared: string[] = [];
    for (const [chId, group] of Object.entries(this.data.groups)) {
      if (group.members.includes(userA) && group.members.includes(userB)) {
        shared.push(chId);
      }
    }
    return shared;
  }

  /** Human-readable summary. */
  public getGraphSummary(): string {
    const nodes = Object.keys(this.data.nodes).length;
    const edges = this.data.edges.length;
    const groups = Object.keys(this.data.groups).length;
    return `Social Graph: ${nodes} users, ${edges} connections, ${groups} groups`;
  }
}

let _instance: SocialGraphManager | null = null;
export function getSocialGraphManager(): SocialGraphManager {
  if (!_instance) {_instance = new SocialGraphManager();}
  return _instance;
}
