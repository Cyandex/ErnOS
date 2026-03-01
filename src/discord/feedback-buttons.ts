/**
 * Feedback Buttons — RLHF feedback collection + TTS on Discord replies.
 *
 * Ported from ErnOS V3 `src/ui/views.py` ResponseFeedbackView.
 *
 * Adds 👍/👎/🗣️ buttons to Discord reply messages.
 * - 👍/👎 log RLHF feedback to a JSONL file
 * - 🗣️ generates TTS audio from the reply text and sends it as a voice file
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Button, type ButtonInteraction, type ComponentData } from "@buape/carbon";
import type { RequestClient } from "@buape/carbon";
import { ButtonStyle, Routes, type APIMessage } from "discord-api-types/v10";
import { loadConfig } from "../config/config.js";
import { textToSpeech } from "../tts/tts.js";

const FEEDBACK_KEY = "ernfb";
const TTS_KEY = "erntts";

/** 24-hour cache TTL (ms). */
const TTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** In-memory TTS cache: key = `messageId:userId` → audioPath. */
const ttsCache = new Map<string, { audioPath: string; createdAt: number }>();

/** Build a custom ID for feedback buttons. */
function buildFeedbackCustomId(sentiment: "positive" | "negative"): string {
  return `${FEEDBACK_KEY}:sentiment=${sentiment}`;
}

/** Build a custom ID for the TTS button. */
function buildTtsCustomId(): string {
  return `${TTS_KEY}:action=speak`;
}

/** Parse feedback data from Carbon's ComponentData. */
function parseFeedbackData(data: ComponentData): { sentiment: string } | null {
  const sentiment = (data as Record<string, unknown>).sentiment;
  if (typeof sentiment !== "string") return null;
  return { sentiment };
}

/** Log RLHF feedback to file. */
function logFeedback(userId: string, sentiment: string): void {
  const feedbackDir = path.join(os.homedir(), ".ernos");
  const feedbackPath = path.join(feedbackDir, "rlhf_feedback.jsonl");

  try {
    fs.mkdirSync(feedbackDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      user_id: userId,
      sentiment,
    };
    fs.appendFileSync(feedbackPath, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Non-fatal — feedback logging is best-effort
  }
}

/** Evict expired TTS cache entries. */
function evictExpiredTtsCache(): void {
  const now = Date.now();
  for (const [key, entry] of ttsCache.entries()) {
    if (now - entry.createdAt > TTS_CACHE_TTL_MS) {
      ttsCache.delete(key);
      // Clean up the audio file
      try {
        fs.unlinkSync(entry.audioPath);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Discord Button for positive feedback (👍).
 */
export class FeedbackLikeButton extends Button {
  label = "👍";
  customId = buildFeedbackCustomId("positive");
  style = ButtonStyle.Secondary;

  async run(interaction: ButtonInteraction, data: ComponentData): Promise<void> {
    const parsed = parseFeedbackData(data);
    if (!parsed) return;

    logFeedback(interaction.userId ?? "unknown", "positive");

    try {
      await interaction.reply({
        content: "Thanks for the feedback! ✅",
        ephemeral: true,
      });
    } catch {
      // Interaction token may have expired
    }
  }
}

/**
 * Discord Button for negative feedback (👎).
 */
export class FeedbackDislikeButton extends Button {
  label = "👎";
  customId = buildFeedbackCustomId("negative");
  style = ButtonStyle.Secondary;

  async run(interaction: ButtonInteraction, data: ComponentData): Promise<void> {
    const parsed = parseFeedbackData(data);
    if (!parsed) return;

    logFeedback(interaction.userId ?? "unknown", "negative");

    try {
      await interaction.reply({
        content: "Feedback received. I'll do better.",
        ephemeral: true,
      });
    } catch {
      // Interaction token may have expired
    }
  }
}

/**
 * Discord Button for TTS playback (🗣️).
 *
 * On press: generates TTS audio from the preceding reply message,
 * sends it as a voice file. One generation per message per user,
 * cached for 24 hours.
 */
export class FeedbackTTSButton extends Button {
  label = "🗣️";
  customId = buildTtsCustomId();
  style = ButtonStyle.Secondary;

  async run(interaction: ButtonInteraction, _data: ComponentData): Promise<void> {
    const userId = interaction.userId ?? "unknown";
    const channelId = (interaction as unknown as { rawData?: { channel_id?: string } }).rawData
      ?.channel_id;
    if (!channelId) {
      try {
        await interaction.reply({ content: "Could not identify channel.", ephemeral: true });
      } catch {}
      return;
    }

    // Defer the reply since TTS can take a few seconds
    try {
      await interaction.defer({ ephemeral: true });
    } catch {}

    // Evict stale cache entries
    evictExpiredTtsCache();

    // Find the bot's reply message (the message right before the buttons message)
    let replyText: string | undefined;
    let replyMessageId: string | undefined;
    try {
      const client = interaction.client;
      if (!client?.rest) {
        await interaction.followUp({ content: "TTS unavailable.", ephemeral: true });
        return;
      }
      // Fetch messages before the button message to find the bot's reply
      const buttonMessageId = (
        interaction as unknown as { rawData?: { message?: { id?: string } } }
      ).rawData?.message?.id;
      if (buttonMessageId) {
        const messages = (await client.rest.get(Routes.channelMessages(channelId), {
          before: buttonMessageId,
          limit: 10,
        })) as APIMessage[];

        if (messages.length > 0) {
          // The bot sends its reply (which might be chunked into multiple messages),
          // followed immediately by the feedback buttons message.
          // We want to collect all contiguous messages authored by the bot going backwards.
          const botId = interaction.message?.author?.id || (client as any).user?.id;
          const botMessages = [];
          for (const msg of messages) {
            if (msg.author.id === botId) {
              botMessages.unshift(msg.content); // unshift to reverse the order back to chronological
            } else {
              break; // Stop climbing as soon as we hit a user message
            }
          }

          if (botMessages.length > 0) {
            replyText = botMessages.join("\n\n");
            replyMessageId = messages[0].id; // Use the most recent message ID for the cache key
          }
        }
      }
    } catch {
      // Fallback: no text found
    }

    if (!replyText?.trim()) {
      try {
        await interaction.followUp({ content: "No text to convert to speech.", ephemeral: true });
      } catch {}
      return;
    }

    // Check TTS cache
    const cacheKey = `${replyMessageId ?? channelId}:${userId}`;
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < TTS_CACHE_TTL_MS) {
      // Send cached audio
      try {
        await sendTtsAudio(interaction, channelId, cached.audioPath);
        await interaction.followUp({ content: "🗣️ TTS (cached)", ephemeral: true });
      } catch {
        await interaction.followUp({
          content: "Failed to send cached TTS audio.",
          ephemeral: true,
        });
      }
      return;
    }

    // Generate TTS in the background to avoid blocking the Discord interaction gateway
    (async () => {
      try {
        const cfg = loadConfig();
        const result = await textToSpeech({ text: replyText, cfg });

        if (!result.success || !result.audioPath) {
          await interaction.followUp({
            content: `TTS failed: ${result.error ?? "unknown error"}`,
            ephemeral: true,
          });
          return;
        }

        // Cache the result
        ttsCache.set(cacheKey, { audioPath: result.audioPath, createdAt: Date.now() });

        // Send the audio file to the channel
        await sendTtsAudio(interaction, channelId, result.audioPath);
        await interaction.followUp({
          content: `🗣️ TTS generated (${result.provider ?? "default"}, ${Math.floor(result.latencyMs ?? 0)}ms)`,
          ephemeral: true,
        });
      } catch (err) {
        try {
          await interaction.followUp({
            content: `TTS error: ${String(err)}`,
            ephemeral: true,
          });
        } catch {}
      }
    })();
  }
}

/** Send TTS audio file to a Discord channel. */
async function sendTtsAudio(
  interaction: ButtonInteraction,
  channelId: string,
  audioPath: string,
): Promise<void> {
  const client = interaction.client;
  if (!client?.rest) return;

  const audioData = fs.readFileSync(audioPath);
  const fileName = path.basename(audioPath);
  const blob = new Blob([audioData]);

  // Use the serialization approach
  const { serializePayload } = await import("@buape/carbon");
  const payload = serializePayload({
    files: [{ data: blob, name: fileName }],
  });
  await client.rest.post(Routes.channelMessages(channelId), {
    body: payload,
  });
}

/** Create the feedback button instances for Carbon client registration. */
export function createFeedbackButtons(): Button[] {
  return [new FeedbackLikeButton(), new FeedbackDislikeButton(), new FeedbackTTSButton()];
}

/**
 * Build a Discord action row with feedback buttons.
 * Returns raw Discord API component data for embedding in messages.
 */
export function buildFeedbackActionRow(): {
  type: 1;
  components: Array<{
    type: 2;
    style: number;
    label: string;
    custom_id: string;
  }>;
} {
  return {
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: ButtonStyle.Secondary,
        label: "👍",
        custom_id: buildFeedbackCustomId("positive"),
      },
      {
        type: 2, // BUTTON
        style: ButtonStyle.Secondary,
        label: "👎",
        custom_id: buildFeedbackCustomId("negative"),
      },
      {
        type: 2, // BUTTON
        style: ButtonStyle.Secondary,
        label: "🗣️",
        custom_id: buildTtsCustomId(),
      },
    ],
  };
}

/**
 * Send a standalone message with feedback buttons in a channel.
 * This is called after the final reply is delivered.
 */
export async function sendFeedbackButtons(params: {
  rest: RequestClient;
  channelId: string;
}): Promise<void> {
  try {
    const row = buildFeedbackActionRow();
    await params.rest.post(Routes.channelMessages(params.channelId), {
      body: { components: [row] },
    });
  } catch {
    // Non-fatal — feedback buttons are optional UX
  }
}
