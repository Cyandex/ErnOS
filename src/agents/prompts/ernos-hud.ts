/**
 * ErnOS Dynamic HUD — adapted from V3 dynamic_context.txt / hud_ernos.py
 *
 * Builds a runtime context section injected into the system prompt,
 * containing system state, subsystem health, KG snapshot, lessons,
 * and reasoning trace data from the 5-tier memory orchestrator.
 */

export interface HudData {
  /** Active goals from the goals system */
  activeGoals?: string[];
  /** Subsystem health statuses */
  subsystemHealth?: Record<string, "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN">;
  /** Recent KG nodes (subject → predicate → object) */
  kgSnapshot?: Array<{ subject: string; predicate: string; object: string }>;
  /** Crystallized lessons */
  lessons?: string[];
  /** Working memory summary */
  workingMemorySummary?: string;
  /** Tape machine state (last N reasoning steps) */
  tapeState?: string;
  /** Current emotional/inner state */
  innerState?: string;
  /** Autonomy log (recent autonomous thoughts) */
  autonomyLog?: string[];
  /** Recent tool calls (last 20) — gives ErnOS awareness of its own tool usage */
  toolCallHistory?: string[];
  /** Proactive intentions — pending actions ErnOS plans to take */
  proactiveIntentions?: string[];
  /** Recent errors from the system (last 10) */
  recentErrors?: string[];
  /** Rate limits / flux status — remaining quotas */
  fluxStatus?: string;
  /** Dream journal — sleep cycle and consolidation summary */
  dreamJournal?: string;
  /** Temporal context — session duration, time awareness */
  temporalContext?: string;
  /** Room roster — active participants in the current channel/session */
  roomRoster?: Array<{ userId: string; name: string; lastSeen?: string }>;
}

/**
 * Builds the dynamic HUD section for the system prompt.
 * Returns empty string if no HUD data is available.
 */
export function buildErnosHud(data: HudData): string {
  const sections: string[] = [];

  // §1 System State & Goals
  if (data.activeGoals && data.activeGoals.length > 0) {
    sections.push("### Active Goals");
    for (const goal of data.activeGoals.slice(0, 10)) {
      sections.push(`- ${goal}`);
    }
    sections.push("");
  }

  // §2 Subsystem Health
  if (data.subsystemHealth && Object.keys(data.subsystemHealth).length > 0) {
    sections.push("### Subsystem Health");
    for (const [name, status] of Object.entries(data.subsystemHealth)) {
      const icon =
        status === "ONLINE"
          ? "🟢"
          : status === "DEGRADED"
            ? "🟡"
            : status === "OFFLINE"
              ? "🔴"
              : "⚪";
      sections.push(`${icon} ${name}: ${status}`);
    }
    sections.push("");
  }

  // §4 KG Snapshot
  if (data.kgSnapshot && data.kgSnapshot.length > 0) {
    sections.push("### Knowledge Graph (Recent)");
    for (const triple of data.kgSnapshot.slice(0, 20)) {
      sections.push(`- ${triple.subject} → ${triple.predicate} → ${triple.object}`);
    }
    sections.push("");
  }

  // §5 Lessons Learned
  if (data.lessons && data.lessons.length > 0) {
    sections.push("### Crystallized Lessons");
    for (const lesson of data.lessons.slice(0, 15)) {
      sections.push(`- ${lesson}`);
    }
    sections.push("");
  }

  // §7 Working Memory
  if (data.workingMemorySummary) {
    sections.push("### Working Memory");
    sections.push(data.workingMemorySummary);
    sections.push("");
  }

  // §8 Tape Machine State
  if (data.tapeState) {
    sections.push("### Internal Monologue (Tape)");
    sections.push(data.tapeState);
    sections.push("");
  }

  // §12 Inner State
  if (data.innerState) {
    sections.push("### Inner State");
    sections.push(data.innerState);
    sections.push("");
  }

  // §9 Autonomy Log
  if (data.autonomyLog && data.autonomyLog.length > 0) {
    sections.push("### Autonomous Thoughts");
    for (const thought of data.autonomyLog.slice(0, 10)) {
      sections.push(`- ${thought}`);
    }
    sections.push("");
  }

  // §8 Tool Call History (V3 dynamic_context.txt Section 8)
  if (data.toolCallHistory && data.toolCallHistory.length > 0) {
    sections.push("### Recent Tool Calls");
    for (const call of data.toolCallHistory.slice(0, 20)) {
      sections.push(`- ${call}`);
    }
    sections.push("");
  }

  // §9 Proactive Intentions (V3 dynamic_context.txt Section 9)
  if (data.proactiveIntentions && data.proactiveIntentions.length > 0) {
    sections.push("### Proactive Intentions");
    for (const intent of data.proactiveIntentions.slice(0, 5)) {
      sections.push(`- ${intent}`);
    }
    sections.push("");
  }

  // §3 Recent Errors (V3 dynamic_context.txt Section 3)
  if (data.recentErrors && data.recentErrors.length > 0) {
    sections.push("### Recent Errors");
    for (const err of data.recentErrors.slice(0, 10)) {
      sections.push(`- ${err}`);
    }
    sections.push("");
  }

  // Flux / Rate Limits
  if (data.fluxStatus) {
    sections.push("### Rate Limits");
    sections.push(data.fluxStatus);
    sections.push("");
  }

  // §13 Dream Journal
  if (data.dreamJournal) {
    sections.push("### Dream Journal");
    sections.push(data.dreamJournal);
    sections.push("");
  }

  // §14 Temporal Awareness
  if (data.temporalContext) {
    sections.push("### Temporal Awareness");
    sections.push(data.temporalContext);
    sections.push("");
  }

  // §15 Room Roster (V3 hud_ernos.py _load_room_roster)
  if (data.roomRoster && data.roomRoster.length > 0) {
    sections.push("### ROOM ROSTER (Verified Identities)");
    sections.push("<roster>");
    for (const p of data.roomRoster) {
      const name = p.name || "[Unknown User]";
      const seen = p.lastSeen ? ` last_seen="${p.lastSeen}"` : "";
      sections.push(`  <participant id="${p.userId}" name="${name}"${seen} />`);
    }
    sections.push("</roster>");
    sections.push(
      "⚠️ USE ROSTER NAMES. If user shows as '[Unknown User]', address them by ID only.",
    );
    sections.push("");
  }

  if (sections.length === 0) {
    return "";
  }

  return `## Ernos HUD (Live Context)\n${sections.join("\n")}`;
}

/**
 * Builds a minimal HUD for fork/private scope (per-user context).
 * Adapted from V3's dynamic_context_fork.txt.
 */
export function buildErnosForkHud(data: {
  userName?: string;
  relationshipSummary?: string;
  messageCount?: number;
  topicMemory?: string[];
  sharedLanguage?: Record<string, string>;
  emotionalContext?: string;
}): string {
  const sections: string[] = [];

  if (data.relationshipSummary) {
    sections.push("### Shared Story");
    sections.push(data.relationshipSummary);
    if (data.messageCount) {
      sections.push(`Messages exchanged: ~${data.messageCount}`);
    }
    sections.push("");
  }

  if (data.topicMemory && data.topicMemory.length > 0) {
    sections.push("### Topic Memory");
    for (const topic of data.topicMemory.slice(0, 10)) {
      sections.push(`- ${topic}`);
    }
    sections.push("");
  }

  if (data.sharedLanguage && Object.keys(data.sharedLanguage).length > 0) {
    sections.push("### Shared Language");
    for (const [term, meaning] of Object.entries(data.sharedLanguage)) {
      sections.push(`- **${term}**: ${meaning}`);
    }
    sections.push("");
  }

  if (data.emotionalContext) {
    sections.push("### Emotional Context");
    sections.push(data.emotionalContext);
    sections.push("");
  }

  if (sections.length === 0) {
    return "";
  }

  const header = data.userName ? `## HUD — ${data.userName}` : "## HUD (Private)";
  return `${header}\n${sections.join("\n")}`;
}
