/**
 * ChatDev Bridge — Core Integration Layer
 *
 * Provides the interface between ErnOS and ChatDev's workflow engine.
 * Handles workflow execution, event streaming, result mapping, and
 * privacy scope enforcement.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { PrivacyScopeValue } from "../privacy/scope.js";
import type { ChatDevSidecar } from "./sidecar.js";

const log = createSubsystemLogger("chatdev-bridge");

// ─── Types ─────────────────────────────────────────────────────────────

export interface WorkflowExecuteParams {
  /** YAML workflow filename (e.g., "ChatDev_v1.yaml") */
  yamlFile: string;
  /** User's task prompt */
  taskPrompt: string;
  /** Optional file attachments */
  attachments?: string[];
  /** Variable overrides */
  variables?: Record<string, string>;
  /** Session name for output isolation */
  sessionName?: string;
  /** Requesting user's ID */
  userId?: string;
  /** Privacy scope context */
  scope?: PrivacyScopeValue;
}

export interface WorkflowEvent {
  type:
    | "agent_message"
    | "tool_call"
    | "tool_result"
    | "human_input_request"
    | "workflow_complete"
    | "workflow_error"
    | "status_update";
  /** Node ID that emitted this event */
  nodeId?: string;
  /** Agent role name */
  agentRole?: string;
  /** The message content */
  content?: string;
  /** Tool call details */
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    result?: string;
  };
  /** Human input prompt details */
  humanPrompt?: {
    description: string;
    timeout?: number;
  };
  /** Final workflow result */
  result?: WorkflowResult;
  /** Error details */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

export interface WorkflowResult {
  /** Final message from the workflow */
  finalMessage?: string;
  /** Session name */
  sessionName: string;
  /** Output directory path */
  outputDir: string;
  /** Token usage stats */
  tokenUsage?: Record<string, unknown>;
  /** Workflow status */
  status: "completed" | "failed" | "cancelled";
}

export type WorkflowEventHandler = (event: WorkflowEvent) => void | Promise<void>;

// ─── Active Workflow Tracking ──────────────────────────────────────────

interface ActiveWorkflow {
  sessionName: string;
  userId?: string;
  scope?: PrivacyScopeValue;
  startedAt: number;
  ws?: WebSocket;
  eventHandlers: WorkflowEventHandler[];
  abortController?: AbortController;
}

// ─── Bridge Class ──────────────────────────────────────────────────────

export class ChatDevBridge {
  private sidecar: ChatDevSidecar;
  private activeWorkflows: Map<string, ActiveWorkflow> = new Map();

  constructor(sidecar: ChatDevSidecar) {
    this.sidecar = sidecar;
  }

  /**
   * Execute a ChatDev workflow via the REST API.
   * Returns events via the provided handler.
   */
  async executeWorkflow(
    params: WorkflowExecuteParams,
    onEvent?: WorkflowEventHandler,
  ): Promise<WorkflowResult> {
    const baseUrl = this.sidecar.getBaseUrl();
    const sessionName = params.sessionName ?? `ernos_${params.userId ?? "anon"}_${Date.now()}`;

    log.info(
      `Executing workflow: yaml=${params.yamlFile} session=${sessionName} user=${params.userId ?? "?"}`,
    );

    // Track the active workflow
    const workflow: ActiveWorkflow = {
      sessionName,
      userId: params.userId,
      scope: params.scope,
      startedAt: Date.now(),
      eventHandlers: onEvent ? [onEvent] : [],
    };
    this.activeWorkflows.set(sessionName, workflow);

    try {
      // Connect WebSocket for real-time events first — MUST await so session
      // is registered on the server before we fire the HTTP execute request.
      const wsUrl = `${baseUrl.replace("http", "ws")}/ws`;
      const serverSessionId = await this.connectWorkflowWebSocket(wsUrl, sessionName, workflow);
      const effectiveSessionId = serverSessionId || sessionName;

      // Execute via REST API
      const abortController = new AbortController();
      workflow.abortController = abortController;

      const response = await fetch(`${baseUrl}/api/workflow/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yaml_file: params.yamlFile,
          task_prompt: params.taskPrompt,
          attachments: params.attachments ?? [],
          session_id: effectiveSessionId,
          variables: params.variables ?? {},
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Workflow execution failed (${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as Record<string, unknown>;

      const workflowResult: WorkflowResult = {
        finalMessage: (result.final_message as string) ?? undefined,
        sessionName,
        outputDir: (result.output_dir as string) ?? "",
        tokenUsage: result.token_usage as Record<string, unknown>,
        status: "completed",
      };

      // Emit completion event
      await this.emitEvent(sessionName, {
        type: "workflow_complete",
        result: workflowResult,
        timestamp: Date.now(),
      });

      return workflowResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.warn(`Workflow execution error: ${errorMsg}`);

      await this.emitEvent(sessionName, {
        type: "workflow_error",
        error: errorMsg,
        timestamp: Date.now(),
      });

      return {
        finalMessage: undefined,
        sessionName,
        outputDir: "",
        status: "failed",
      };
    } finally {
      // Cleanup
      const wf = this.activeWorkflows.get(sessionName);
      if (wf?.ws) {
        wf.ws.close();
      }
      this.activeWorkflows.delete(sessionName);
    }
  }

  /**
   * List available workflows from the ChatDev server.
   */
  async listWorkflows(): Promise<Array<{ filename: string; description?: string }>> {
    const baseUrl = this.sidecar.getBaseUrl();

    try {
      const response = await fetch(`${baseUrl}/api/workflows`);
      if (!response.ok) {
        throw new Error(`Failed to list workflows: ${response.status}`);
      }
      return (await response.json()) as Array<{
        filename: string;
        description?: string;
      }>;
    } catch (err) {
      log.warn(`Failed to list workflows: ${String(err)}`);
      return [];
    }
  }

  /**
   * Send human input to a waiting workflow node.
   */
  async sendHumanInput(sessionName: string, input: string): Promise<void> {
    const workflow = this.activeWorkflows.get(sessionName);
    if (!workflow) {
      throw new Error(`No active workflow found for session: ${sessionName}`);
    }

    if (workflow.ws && workflow.ws.readyState === WebSocket.OPEN) {
      workflow.ws.send(
        JSON.stringify({
          type: "human_input",
          session_name: sessionName,
          content: input,
        }),
      );
    } else {
      // Fallback: POST to REST API
      const baseUrl = this.sidecar.getBaseUrl();
      await fetch(`${baseUrl}/api/workflow/human-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: sessionName,
          content: input,
        }),
      });
    }
  }

  /**
   * Cancel a running workflow.
   */
  cancelWorkflow(sessionName: string): void {
    const workflow = this.activeWorkflows.get(sessionName);
    if (!workflow) {
      return;
    }

    log.info(`Cancelling workflow: ${sessionName}`);
    workflow.abortController?.abort();
    workflow.ws?.close();
    this.activeWorkflows.delete(sessionName);
  }

  /**
   * Get status of all active workflows.
   */
  getActiveWorkflows(): Array<{
    sessionName: string;
    userId?: string;
    startedAt: number;
    durationMs: number;
  }> {
    const now = Date.now();
    return [...this.activeWorkflows.entries()].map(([name, wf]) => ({
      sessionName: name,
      userId: wf.userId,
      startedAt: wf.startedAt,
      durationMs: now - wf.startedAt,
    }));
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private connectWorkflowWebSocket(
    wsUrl: string,
    sessionName: string,
    workflow: ActiveWorkflow,
  ): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, _reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        workflow.ws = ws;

        // Resolve once the WebSocket is open — the server has registered the session.
        const openTimeout = setTimeout(() => {
          resolve(undefined); // Don't block forever; proceed even if WS is slow.
        }, 5000);

        ws.addEventListener("open", () => {
          log.info(`WebSocket connected for workflow: ${sessionName}`);
          // Wait for the server's 'connection' event before resolving.
        });

        ws.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(String(event.data)) as Record<string, unknown>;

            const payload = data.data as Record<string, unknown> | undefined;

            if (data.type === "connection" && typeof payload?.session_id === "string") {
              clearTimeout(openTimeout);
              resolve(payload.session_id);
            }

            // Map ChatDev WebSocket events to our event types
            const workflowEvent = this.mapChatDevEvent(data, sessionName);
            if (workflowEvent) {
              void this.emitEvent(sessionName, workflowEvent);
            }
          } catch {
            // Ignore unparseable messages
          }
        });

        ws.addEventListener("error", () => {
          clearTimeout(openTimeout);
          log.warn(`WebSocket error for workflow: ${sessionName}`);
          resolve(undefined); // Don't reject — fall through to HTTP-only mode.
        });

        ws.addEventListener("close", () => {
          log.info(`WebSocket closed for workflow: ${sessionName}`);
        });
      } catch {
        log.warn(`Failed to connect WebSocket for workflow: ${sessionName}`);
        resolve(undefined); // Don't block execution if WS fails entirely.
      }
    });
  }

  private mapChatDevEvent(
    data: Record<string, unknown>,
    _sessionName: string,
  ): WorkflowEvent | null {
    const eventType = data.type as string | undefined;

    if (eventType === "agent_message" || eventType === "message") {
      return {
        type: "agent_message",
        nodeId: data.node_id as string | undefined,
        agentRole: data.role as string | undefined,
        content: data.content as string | undefined,
        timestamp: Date.now(),
      };
    }

    if (eventType === "tool_call") {
      return {
        type: "tool_call",
        nodeId: data.node_id as string | undefined,
        toolCall: {
          name: (data.tool_name as string) ?? "unknown",
          args: (data.arguments as Record<string, unknown>) ?? {},
        },
        timestamp: Date.now(),
      };
    }

    if (eventType === "tool_result") {
      return {
        type: "tool_result",
        nodeId: data.node_id as string | undefined,
        toolCall: {
          name: (data.tool_name as string) ?? "unknown",
          args: {},
          result: data.result as string | undefined,
        },
        timestamp: Date.now(),
      };
    }

    if (eventType === "human_input" || eventType === "human_request") {
      return {
        type: "human_input_request",
        nodeId: data.node_id as string | undefined,
        humanPrompt: {
          description: (data.description as string) ?? (data.prompt as string) ?? "",
          timeout: data.timeout as number | undefined,
        },
        timestamp: Date.now(),
      };
    }

    if (eventType === "status") {
      return {
        type: "status_update",
        content: data.message as string | undefined,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  private async emitEvent(sessionName: string, event: WorkflowEvent): Promise<void> {
    const workflow = this.activeWorkflows.get(sessionName);
    if (!workflow) {
      return;
    }

    for (const handler of workflow.eventHandlers) {
      try {
        await handler(event);
      } catch (err) {
        log.warn(`Event handler error: ${String(err)}`);
      }
    }
  }
}
