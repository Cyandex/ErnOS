/**
 * Analytics Tools — Structured productivity and system health reports.
 *
 * Provides daily and weekly summaries of Ernos's activity:
 * tool usage, errors/warnings, work sessions, and user engagement.
 * Reports written to memory/core/reports/.
 *
 * Ported from V3's `tools/analytics.py` (9.8K).
 */

import * as fs from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

const REPORTS_DIR = path.join(process.cwd(), "memory", "core", "reports");
const LOG_PATH = path.join(process.cwd(), "ernos.log");

function ensureDirs(): void {
  if (!fs.existsSync(REPORTS_DIR)) {fs.mkdirSync(REPORTS_DIR, { recursive: true });}
}

interface DayMetrics {
  toolCalls: Map<string, number>;
  errors: number;
  warnings: number;
  userMessages: number;
  workSessions: number;
  systemCalls: Map<string, number>;
}

/**
 * Parse log file for entries matching a specific date (YYYY-MM-DD).
 */
function parseLogForDate(dateStr: string): DayMetrics {
  const metrics: DayMetrics = {
    toolCalls: new Map(),
    errors: 0,
    warnings: 0,
    userMessages: 0,
    workSessions: 0,
    systemCalls: new Map(),
  };

  if (!fs.existsSync(LOG_PATH)) {return metrics;}

  try {
    const content = fs.readFileSync(LOG_PATH, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.startsWith(dateStr)) {continue;}

      if (line.includes("[ERROR]")) {metrics.errors++;}
      else if (line.includes("[WARNING]")) {metrics.warnings++;}

      // Tool calls
      const toolMatch = line.match(/Tool Executed: (\w+)/);
      if (toolMatch) {
        const name = toolMatch[1];
        metrics.toolCalls.set(name, (metrics.toolCalls.get(name) || 0) + 1);
      }

      // User messages
      if (line.includes("Processing message from")) {metrics.userMessages++;}

      // Work sessions
      if (line.includes("WORK MODE")) {metrics.workSessions++;}

      // System calls
      const sysMatch = line.match(/System\.(\w+)/);
      if (sysMatch) {
        const name = sysMatch[1];
        metrics.systemCalls.set(name, (metrics.systemCalls.get(name) || 0) + 1);
      }
    }
  } catch {
    /* best-effort */
  }

  return metrics;
}

/** Sort map entries by value descending and return top N. */
function topN(map: Map<string, number>, n: number): Array<[string, number]> {
  return [...map.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, n);
}

function formatReport(dateStr: string, metrics: DayMetrics): string {
  const lines = [
    `# Ernos Daily Report — ${dateStr}`,
    `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    "",
    "## System Health",
    `- **Errors**: ${metrics.errors}`,
    `- **Warnings**: ${metrics.warnings}`,
    "",
    "## User Engagement",
    `- **Messages Processed**: ${metrics.userMessages}`,
    "",
    "## Autonomous Work",
    `- **Work Sessions**: ${metrics.workSessions}`,
  ];

  if (metrics.toolCalls.size) {
    lines.push("", "## Tool Usage (Top 15)");
    for (const [tool, count] of topN(metrics.toolCalls, 15)) {
      lines.push(`- \`${tool}\`: ${count}`);
    }
  }

  if (metrics.systemCalls.size) {
    lines.push("", "## System Activity");
    for (const [system, count] of topN(metrics.systemCalls, 10)) {
      lines.push(`- **${system}**: ${count} activations`);
    }
  }

  return lines.join("\n");
}

const DailyReportSchema = Type.Object({
  date: Type.Optional(
    Type.String({
      description: "Date in YYYY-MM-DD format (defaults to today).",
    }),
  ),
});

const WeeklySummarySchema = Type.Object({});

export function createAnalyticsTools(): AnyAgentTool[] {
  return [
    {
      label: "Daily Report",
      name: "get_daily_report",
      description: "Generate a structured daily productivity and system health report.",
      parameters: DailyReportSchema,
      execute: async (_toolCallId, args) => {
        ensureDirs();
        const params = args as Record<string, unknown>;
        const dateStr =
          readStringParam(params, "date") || new Date().toISOString().slice(0, 10);

        const metrics = parseLogForDate(dateStr);
        const report = formatReport(dateStr, metrics);

        // Save to disk
        const reportPath = path.join(REPORTS_DIR, `${dateStr}.md`);
        fs.writeFileSync(reportPath, report, "utf-8");
        console.log(`[Analytics] Daily report written to ${reportPath}`);

        return {
          content: [{ type: "text", text: report }],
          details: { reportPath },
        };
      },
    },
    {
      label: "Weekly Summary",
      name: "get_weekly_summary",
      description: "Aggregate daily reports into a weekly productivity summary.",
      parameters: WeeklySummarySchema,
      execute: async () => {
        ensureDirs();

        const today = new Date();
        // Find Monday of current week
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

        const lines = [
          "# Ernos Weekly Summary",
          `Week of ${monday.toISOString().slice(0, 10)}`,
          `Generated: ${today.toISOString().slice(0, 19).replace("T", " ")}`,
          "",
        ];

        let totalErrors = 0;
        let totalWarnings = 0;
        let totalMessages = 0;
        let totalWorkSessions = 0;
        const totalToolCalls = new Map<string, number>();
        let daysWithData = 0;
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        for (let i = 0; i < 7; i++) {
          const day = new Date(monday);
          day.setDate(monday.getDate() + i);
          if (day > today) {break;}

          const dateStr = day.toISOString().slice(0, 10);
          const dayName = dayNames[day.getDay()];
          const metrics = parseLogForDate(dateStr);
          const hasData = metrics.userMessages > 0 || metrics.errors > 0;

          if (hasData) {
            daysWithData++;
            totalErrors += metrics.errors;
            totalWarnings += metrics.warnings;
            totalMessages += metrics.userMessages;
            totalWorkSessions += metrics.workSessions;
            for (const [tool, count] of metrics.toolCalls) {
              totalToolCalls.set(tool, (totalToolCalls.get(tool) || 0) + count);
            }
            lines.push(
              `- **${dayName}** (${dateStr}): ` +
                `${metrics.userMessages} msgs, ` +
                `${metrics.errors} errors, ` +
                `${metrics.workSessions} work sessions`,
            );
          } else {
            lines.push(`- **${dayName}** (${dateStr}): No activity`);
          }
        }

        lines.push(
          "",
          "## Weekly Totals",
          `- **Active Days**: ${daysWithData}`,
          `- **Total Messages**: ${totalMessages}`,
          `- **Total Errors**: ${totalErrors}`,
          `- **Total Warnings**: ${totalWarnings}`,
          `- **Work Sessions**: ${totalWorkSessions}`,
          `- **Unique Tools Used**: ${totalToolCalls.size}`,
        );

        if (totalToolCalls.size) {
          lines.push("", "## Most Used Tools");
          for (const [tool, count] of topN(totalToolCalls, 10)) {
            lines.push(`- \`${tool}\`: ${count}`);
          }
        }

        const report = lines.join("\n");

        // Save
        const weekStr = `${monday.getFullYear()}-W${String(Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`;
        const reportPath = path.join(REPORTS_DIR, `week_${weekStr}.md`);
        fs.writeFileSync(reportPath, report, "utf-8");
        console.log(`[Analytics] Weekly summary written to ${reportPath}`);

        return {
          content: [{ type: "text", text: report }],
          details: { reportPath },
        };
      },
    },
  ];
}
