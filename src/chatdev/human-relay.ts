/**
 * ChatDev Human Relay
 *
 * Bridges ChatDev's `human` nodes to ErnOS's Discord/WebUI channels.
 * When a workflow pauses for human input, the prompt is relayed to
 * the user's current session and their response is forwarded back.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { ChatDevBridge, WorkflowEvent } from "./bridge.js";

const log = createSubsystemLogger("chatdev-human-relay");

// ─── Types ─────────────────────────────────────────────────────────────

export interface HumanRelayConfig {
  /** Default timeout for human input (ms) — default 5 minutes */
  defaultTimeoutMs?: number;
  /** Max concurrent pending requests per user */
  maxPendingPerUser?: number;
}

export interface PendingHumanRequest {
  /** Workflow session name */
  sessionName: string;
  /** The prompt/question from the human node */
  prompt: string;
  /** User ID this request is for */
  userId: string;
  /** ErnOS session key to relay to */
  sessionKey: string;
  /** When the request was created */
  createdAt: number;
  /** Timeout in ms */
  timeoutMs: number;
  /** Resolve function — called when user responds */
  resolve: (input: string) => void;
  /** Reject function — called on timeout/cancel */
  reject: (reason: string) => void;
}

export type SendToSessionFn = (params: {
  sessionKey: string;
  userId: string;
  message: string;
}) => Promise<void>;

// ─── Human Relay ───────────────────────────────────────────────────────

export class HumanRelay {
  private bridge: ChatDevBridge;
  private pending: Map<string, PendingHumanRequest> = new Map();
  private sendToSession: SendToSessionFn;
  private config: Required<HumanRelayConfig>;
  private timeoutTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(bridge: ChatDevBridge, sendToSession: SendToSessionFn, config?: HumanRelayConfig) {
    this.bridge = bridge;
    this.sendToSession = sendToSession;
    this.config = {
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 300_000, // 5 min
      maxPendingPerUser: config?.maxPendingPerUser ?? 3,
    };
  }

  /**
   * Create a workflow event handler that listens for human input requests
   * and relays them to the user's session.
   */
  createEventHandler(params: {
    userId: string;
    sessionKey: string;
  }): (event: WorkflowEvent) => Promise<void> {
    return async (event: WorkflowEvent) => {
      if (event.type !== "human_input_request" || !event.humanPrompt) {
        return;
      }

      log.info(`Human input requested: node=${event.nodeId ?? "?"} user=${params.userId}`);

      // Check pending limit
      const userPending = [...this.pending.values()].filter((r) => r.userId === params.userId);
      if (userPending.length >= this.config.maxPendingPerUser) {
        log.warn(`Max pending requests reached for user ${params.userId}`);
        return;
      }

      // Create a pending request with promise resolution
      const requestId = `${params.userId}_${Date.now()}`;
      const timeoutMs = event.humanPrompt.timeout ?? this.config.defaultTimeoutMs;

      const inputPromise = new Promise<string>((resolve, reject) => {
        const request: PendingHumanRequest = {
          sessionName: event.nodeId ?? "unknown",
          prompt: event.humanPrompt!.description,
          userId: params.userId,
          sessionKey: params.sessionKey,
          createdAt: Date.now(),
          timeoutMs,
          resolve,
          reject,
        };

        this.pending.set(requestId, request);

        // Set timeout
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          this.timeoutTimers.delete(requestId);
          reject("Human input timed out");
        }, timeoutMs);
        this.timeoutTimers.set(requestId, timer);
      });

      // Send the prompt to the user's channel
      const formattedPrompt = this.formatHumanPrompt(
        event.humanPrompt.description,
        event.nodeId,
        requestId,
      );

      await this.sendToSession({
        sessionKey: params.sessionKey,
        userId: params.userId,
        message: formattedPrompt,
      });

      // Wait for user response and forward to ChatDev
      try {
        const userInput = await inputPromise;
        // The bridge will forward this to ChatDev's human node
        await this.bridge.sendHumanInput(event.nodeId ?? "unknown", userInput);
      } catch (err) {
        log.info(`Human input not received: ${err}`);
      }
    };
  }

  /**
   * Called when a user sends a message that should be interpreted
   * as a response to a pending human input request.
   */
  handleUserResponse(userId: string, input: string): boolean {
    // Find the oldest pending request for this user
    for (const [requestId, request] of this.pending.entries()) {
      if (request.userId === userId) {
        log.info(`Human input received from ${userId} for request ${requestId}`);

        // Clear timeout
        const timer = this.timeoutTimers.get(requestId);
        if (timer) {
          clearTimeout(timer);
          this.timeoutTimers.delete(requestId);
        }

        // Resolve the promise
        request.resolve(input);
        this.pending.delete(requestId);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user has pending human input requests.
   */
  hasPendingRequest(userId: string): boolean {
    return [...this.pending.values()].some((r) => r.userId === userId);
  }

  /**
   * Cancel all pending requests for a user.
   */
  cancelPending(userId: string): void {
    for (const [requestId, request] of this.pending.entries()) {
      if (request.userId === userId) {
        const timer = this.timeoutTimers.get(requestId);
        if (timer) {
          clearTimeout(timer);
          this.timeoutTimers.delete(requestId);
        }
        request.reject("Cancelled by user");
        this.pending.delete(requestId);
      }
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    for (const request of this.pending.values()) {
      request.reject("Relay disposed");
    }
    this.pending.clear();
    this.timeoutTimers.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private formatHumanPrompt(description: string, nodeId?: string, requestId?: string): string {
    const header = nodeId
      ? `🤖 **DevTeam** (${nodeId}) needs your input:`
      : "🤖 **DevTeam** needs your input:";

    return [
      header,
      "",
      description,
      "",
      `_Reply to this message to provide your input. Request: \`${requestId ?? "?"}\`_`,
    ].join("\n");
  }
}
