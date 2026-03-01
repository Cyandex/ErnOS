import { EventEmitter } from "events";
import { randomUUID } from "node:crypto";

export interface AgentMessage {
  id: string;
  source: string;
  target: string | "BROADCAST";
  topic: string;
  payload: any;
  timestamp: number;
}

export class AgentBus {
  private emitter = new EventEmitter();

  /**
   * Subscribe to a specific topic or target queue.
   */
  public subscribe(topic: string, handler: (payload: any, source: string) => void) {
    this.emitter.on(topic, (msg: AgentMessage) => {
      handler(msg.payload, msg.source);
    });
  }

  /**
   * Publish a fire-and-forget message.
   */
  public publish(source: string, target: string | "BROADCAST", topic: string, payload: any) {
    const msg: AgentMessage = {
      id: `msg_${randomUUID()}`,
      source,
      target,
      topic,
      payload,
      timestamp: Date.now(),
    };

    this.emitter.emit(topic, msg);
    if (target !== "BROADCAST") {
      this.emitter.emit(`direct:${target}`, msg);
    }
  }

  /**
   * Request/Response pattern across the bus.
   */
  public async request(
    target: string,
    action: string,
    payload: any = {},
    timeoutMs: number = 30000,
  ): Promise<any> {
    const correlationId = `req_${randomUUID()}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.emitter.removeAllListeners(`reply:${correlationId}`);
        reject(new Error(`AgentBus request to ${target} timed out`));
      }, timeoutMs);

      this.emitter.once(`reply:${correlationId}`, (msg: AgentMessage) => {
        clearTimeout(timeout);
        resolve(msg.payload);
      });

      this.publish("SystemCoordinator", target, action, {
        ...payload,
        __correlationId: correlationId,
      });
    });
  }

  public reply(source: string, correlationId: string, payload: any) {
    this.emitter.emit(`reply:${correlationId}`, { source, payload });
  }
}

export const agentBus = new AgentBus();
