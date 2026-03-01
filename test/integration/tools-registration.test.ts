/**
 * Integration tests for tool registration.
 * Verifies that createErnOSTools() returns all expected tool definitions
 * including the newly added tape, calendar, goals, misc, and swarm tools.
 */
import { describe, it, expect } from "vitest";
import { createErnOSTools } from "../../src/agents/ernos-tools";

describe("Tool Registration Integration", () => {
  const tools = createErnOSTools({
    agentAccountId: "test-user",
  });

  it("should return a non-empty array of tools", () => {
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  const toolNames = tools.map((t: any) => t.name);

  describe("Tape Tools", () => {
    it("should include tape_seek", () => {
      expect(toolNames).toContain("tape_seek");
    });

    it("should include tape_read", () => {
      expect(toolNames).toContain("tape_read");
    });

    it("should include tape_write", () => {
      expect(toolNames).toContain("tape_write");
    });

    it("should include tape_scan", () => {
      expect(toolNames).toContain("tape_scan");
    });

    it("should include tape_fork", () => {
      expect(toolNames).toContain("tape_fork");
    });
  });

  describe("Calendar Tools", () => {
    it("should include calendar tools", () => {
      const calendarTools = toolNames.filter(
        (n: string) => n.startsWith("calendar_") || n.includes("calendar"),
      );
      expect(calendarTools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Goals Tools", () => {
    it("should include goals tools", () => {
      const goalsTools = toolNames.filter(
        (n: string) => n.startsWith("goal") || n.includes("goal"),
      );
      expect(goalsTools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Swarm Tools", () => {
    it("should include introspect", () => {
      expect(toolNames).toContain("introspect");
    });

    it("should include plan_task", () => {
      expect(toolNames).toContain("plan_task");
    });

    it("should include advance_task", () => {
      expect(toolNames).toContain("advance_task");
    });

    it("should include task_status", () => {
      expect(toolNames).toContain("task_status");
    });

    it("should include generate_execution_plan", () => {
      expect(toolNames).toContain("generate_execution_plan");
    });
  });

  describe("Tool structure", () => {
    it("all tools should have name and description", () => {
      for (const tool of tools as any[]) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
      }
    });
  });
});
