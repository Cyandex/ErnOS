/**
 * ChatDev Sidecar Manager
 *
 * Manages ChatDev's FastAPI server as a child process.
 * Handles start/stop, health checking, auto-restart, and log forwarding.
 */

import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("chatdev-sidecar");

export interface ChatDevSidecarConfig {
  /** Path to ChatDev clone directory */
  chatdevPath: string;
  /** Port for the FastAPI server (default: 8766) */
  port?: number;
  /** Host to bind (default: 127.0.0.1) */
  host?: string;
  /** Python executable or `uv run` path */
  pythonCommand?: string;
  /** Log level for the server */
  logLevel?: "debug" | "info" | "warning" | "error";
  /** Auto-restart on crash */
  autoRestart?: boolean;
  /** Max restart attempts */
  maxRestarts?: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs?: number;
}

const DEFAULTS = {
  port: 8766,
  host: "127.0.0.1",
  pythonCommand: "uv run",
  logLevel: "info" as const,
  autoRestart: true,
  maxRestarts: 5,
  healthCheckIntervalMs: 15000,
};

export type SidecarStatus = "stopped" | "starting" | "running" | "error" | "restarting";

export class ChatDevSidecar {
  private process: ChildProcess | null = null;
  private status: SidecarStatus = "stopped";
  private restartCount = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<ChatDevSidecarConfig>;

  constructor(config: ChatDevSidecarConfig) {
    this.config = {
      port: config.port ?? DEFAULTS.port,
      host: config.host ?? DEFAULTS.host,
      pythonCommand: config.pythonCommand ?? DEFAULTS.pythonCommand,
      logLevel: config.logLevel ?? DEFAULTS.logLevel,
      autoRestart: config.autoRestart ?? DEFAULTS.autoRestart,
      maxRestarts: config.maxRestarts ?? DEFAULTS.maxRestarts,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? DEFAULTS.healthCheckIntervalMs,
      chatdevPath: config.chatdevPath,
    };
  }

  /** Start the ChatDev FastAPI server as a subprocess */
  async start(): Promise<void> {
    if (this.status === "running") {
      log.info("ChatDev sidecar already running");
      return;
    }

    this.status = "starting";
    log.info(
      `Starting ChatDev sidecar at ${this.config.host}:${this.config.port} from ${this.config.chatdevPath}`,
    );

    const cmdParts = this.config.pythonCommand.split(" ");
    const [cmd, ...cmdArgs] = cmdParts;
    if (!cmd) {
      this.status = "error";
      throw new Error("Invalid pythonCommand: empty string");
    }

    const args = [
      ...cmdArgs,
      "server_main.py",
      "--host",
      this.config.host,
      "--port",
      String(this.config.port),
      "--log-level",
      this.config.logLevel,
    ];

    this.process = spawn(cmd, args, {
      cwd: this.config.chatdevPath,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    // Forward stdout
    this.process.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          log.info(`[chatdev] ${line}`);
        }
      }
    });

    // Forward stderr
    this.process.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          log.warn(`[chatdev] ${line}`);
        }
      }
    });

    // Handle exit
    this.process.on("exit", (code, signal) => {
      log.info(`ChatDev sidecar exited: code=${code} signal=${signal}`);
      this.process = null;

      if (this.status !== "stopped") {
        this.status = "error";
        if (this.config.autoRestart && this.restartCount < this.config.maxRestarts) {
          this.restartCount++;
          log.info(
            `Auto-restarting ChatDev sidecar (attempt ${this.restartCount}/${this.config.maxRestarts})`,
          );
          this.status = "restarting";
          setTimeout(() => this.start(), 2000);
        }
      }
    });

    this.process.on("error", (err) => {
      log.warn(`ChatDev sidecar spawn error: ${err.message}`);
      this.status = "error";
    });

    // Wait for health check
    const healthy = await this.waitForHealth(30000);
    if (healthy) {
      this.status = "running";
      this.restartCount = 0;
      log.info("ChatDev sidecar is healthy and ready");
      this.startHealthMonitor();
    } else {
      log.warn("ChatDev sidecar failed health check after 30s");
      this.status = "error";
    }
  }

  /** Stop the sidecar process */
  async stop(): Promise<void> {
    this.status = "stopped";
    this.stopHealthMonitor();

    if (this.process) {
      log.info("Stopping ChatDev sidecar");
      this.process.kill("SIGTERM");

      // Force kill after 5s
      const killTimer = setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGKILL");
        }
      }, 5000);

      await new Promise<void>((resolve) => {
        if (!this.process) {
          clearTimeout(killTimer);
          resolve();
          return;
        }
        this.process.on("exit", () => {
          clearTimeout(killTimer);
          resolve();
        });
      });
      this.process = null;
    }
  }

  /** Check if the server is healthy */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `http://${this.config.host}:${this.config.port}/health`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Get the base URL for API calls */
  getBaseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /** Get current status */
  getStatus(): SidecarStatus {
    return this.status;
  }

  /** Get the PID of the child process */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private async waitForHealth(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    const pollInterval = 1000;

    while (Date.now() - start < timeoutMs) {
      if (await this.healthCheck()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    return false;
  }

  private startHealthMonitor(): void {
    this.stopHealthMonitor();
    this.healthTimer = setInterval(async () => {
      if (this.status === "running") {
        const healthy = await this.healthCheck();
        if (!healthy) {
          log.warn("ChatDev sidecar health check failed");
          this.status = "error";
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }
}
