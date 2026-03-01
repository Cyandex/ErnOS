/**
 * Memory LLM Helper — Lightweight Ollama client for memory subsystem tasks.
 *
 * Used by: Reconciler, Consolidation, Salience Engine, ContextStream.
 * Calls Ollama's /api/generate endpoint directly (non-streaming).
 *
 * This is separate from the agent-layer LLM infrastructure because the memory
 * system runs independently and needs simple, fire-and-forget LLM calls for
 * tasks like conflict detection, summarization, and salience scoring.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory-llm");

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3.5:35b";
const DEFAULT_TIMEOUT_MS = 30_000;

interface MemoryLLMOptions {
  /** Ollama base URL. Default: http://127.0.0.1:11434 */
  baseUrl?: string;
  /** Model name. Default: qwen3.5:35b */
  model?: string;
  /** Request timeout in ms. Default: 30000 */
  timeoutMs?: number;
  /** Temperature. Default: 0.3 (low for factual analysis) */
  temperature?: number;
}

/**
 * Send a prompt to Ollama and get a text response.
 * Uses /api/generate (non-streaming, non-chat) for simple one-shot tasks.
 */
export async function memoryLLMGenerate(
  systemPrompt: string,
  userInput: string,
  options: MemoryLLMOptions = {},
): Promise<string> {
  const baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL;
  const model = options.model || process.env.ERNOS_MEMORY_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const temperature = options.temperature ?? 0.3;

  const prompt = `${systemPrompt}\n\n${userInput}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: 1024, // keep responses concise
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { response: string };
    return (data.response || "").trim();
  } catch (err: any) {
    if (err.name === "AbortError") {
      log.warn(`Memory LLM call timed out after ${timeoutMs}ms`);
      throw new Error(`Memory LLM call timed out after ${timeoutMs}ms`);
    }
    log.warn(`Memory LLM call failed: ${err.message || err}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
