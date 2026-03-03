/**
 * /voice fast | slow — Admin command to swap TTS provider.
 *
 * /voice fast → kokoro (low-latency local TTS)
 * /voice slow → qwen   (high-quality AI TTS)
 */
import { logVerbose } from "../../globals.js";
import { resolveTtsConfig, resolveTtsPrefsPath, setTtsProvider } from "../../tts/tts.js";
import type { CommandHandler } from "./commands-types.js";

export const handleVoiceCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }

  const normalized = params.command.commandBodyNormalized;

  // Only match /voice
  if (normalized !== "/voice" && !normalized.startsWith("/voice ")) {
    return null;
  }

  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /voice command from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const arg = normalized.slice("/voice".length).trim().toLowerCase();

  if (!arg || arg === "status") {
    return {
      shouldContinue: false,
      reply: {
        text:
          "🎙️ **Voice Mode**\n\n" +
          "• `/voice fast` — Switch to Kokoro (fast, local)\n" +
          "• `/voice slow` — Switch to Qwen (high quality, AI)",
      },
    };
  }

  const config = resolveTtsConfig(params.cfg);
  const prefsPath = resolveTtsPrefsPath(config);

  if (arg === "fast") {
    setTtsProvider(prefsPath, "kokoro");
    return {
      shouldContinue: false,
      reply: { text: "⚡ Voice set to **fast** (Kokoro)." },
    };
  }

  if (arg === "slow") {
    setTtsProvider(prefsPath, "qwen");
    return {
      shouldContinue: false,
      reply: { text: "🎵 Voice set to **slow** (Qwen — high quality)." },
    };
  }

  return {
    shouldContinue: false,
    reply: {
      text: "❌ Unknown voice mode. Use `/voice fast` or `/voice slow`.",
    },
  };
};
