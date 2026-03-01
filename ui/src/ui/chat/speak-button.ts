import { html, type TemplateResult } from "lit";
import { icons } from "../icons.ts";

/**
 * TTS "Speak" button — sits next to the Copy button on assistant messages.
 *
 * Uses the gateway's tts.convert method to synthesize speech from the message
 * text and plays it back via the browser's Audio API.
 */

const SPEAK_LABEL = "Speak";
const SPEAKING_LABEL = "Speaking…";
const DONE_LABEL = "Done speaking";
const ERROR_LABEL = "Speak failed";

const DONE_DISPLAY_MS = 1500;
const ERROR_DISPLAY_MS = 2000;

// Track the currently playing audio so we can stop it before playing another.
let activeAudio: HTMLAudioElement | null = null;
let activeButton: HTMLButtonElement | null = null;

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeButton?.isConnected) {
    delete activeButton.dataset.speaking;
    activeButton.removeAttribute("aria-busy");
    activeButton.title = SPEAK_LABEL;
    activeButton.setAttribute("aria-label", SPEAK_LABEL);
  }
  activeButton = null;
}

export function renderSpeakButton(text: string): TemplateResult {
  return html`
    <button
      class="chat-speak-btn"
      type="button"
      title=${SPEAK_LABEL}
      aria-label=${SPEAK_LABEL}
      @click=${async (e: Event) => {
        const btn = e.currentTarget as HTMLButtonElement | null;
        if (!btn) {
          return;
        }

        // If this button is already speaking, stop it.
        if (btn.dataset.speaking === "1") {
          stopActiveAudio();
          return;
        }

        // Stop any other playing audio first.
        stopActiveAudio();

        btn.dataset.speaking = "1";
        btn.setAttribute("aria-busy", "true");
        btn.title = SPEAKING_LABEL;
        btn.setAttribute("aria-label", SPEAKING_LABEL);
        activeButton = btn;

        try {
          // Find the WS client on the app element.
          const app = btn.closest("ernos-app") as
            | (HTMLElement & {
                client?: { request?: (method: string, params?: unknown) => Promise<unknown> };
              })
            | null;
          const client = app?.client;

          if (!client?.request) {
            throw new Error("Gateway not connected");
          }

          const result = (await client.request("tts.convert", {
            text, // No truncation — Kokoro/local providers have no char limit
          })) as { audioUrl?: string; audioBase64?: string; mimeType?: string; error?: string };

          if (!btn.isConnected) {
            return;
          }

          if (result.error) {
            throw new Error(result.error);
          }

          let audioSrc: string;
          if (result.audioUrl) {
            audioSrc = result.audioUrl;
          } else if (result.audioBase64) {
            const mime = result.mimeType || "audio/opus";
            audioSrc = `data:${mime};base64,${result.audioBase64}`;
          } else {
            throw new Error("No audio in response");
          }

          const audio = new Audio(audioSrc);
          activeAudio = audio;

          audio.addEventListener("ended", () => {
            if (!btn.isConnected) {
              return;
            }
            delete btn.dataset.speaking;
            btn.removeAttribute("aria-busy");
            btn.dataset.done = "1";
            btn.title = DONE_LABEL;
            btn.setAttribute("aria-label", DONE_LABEL);
            activeAudio = null;
            activeButton = null;

            window.setTimeout(() => {
              if (!btn.isConnected) {
                return;
              }
              delete btn.dataset.done;
              btn.title = SPEAK_LABEL;
              btn.setAttribute("aria-label", SPEAK_LABEL);
            }, DONE_DISPLAY_MS);
          });

          audio.addEventListener("error", () => {
            if (!btn.isConnected) {
              return;
            }
            delete btn.dataset.speaking;
            btn.removeAttribute("aria-busy");
            btn.dataset.error = "1";
            btn.title = ERROR_LABEL;
            btn.setAttribute("aria-label", ERROR_LABEL);
            activeAudio = null;
            activeButton = null;

            window.setTimeout(() => {
              if (!btn.isConnected) {
                return;
              }
              delete btn.dataset.error;
              btn.title = SPEAK_LABEL;
              btn.setAttribute("aria-label", SPEAK_LABEL);
            }, ERROR_DISPLAY_MS);
          });

          await audio.play();
        } catch {
          if (!btn.isConnected) {
            return;
          }
          delete btn.dataset.speaking;
          btn.removeAttribute("aria-busy");
          btn.dataset.error = "1";
          btn.title = ERROR_LABEL;
          btn.setAttribute("aria-label", ERROR_LABEL);
          activeAudio = null;
          activeButton = null;

          window.setTimeout(() => {
            if (!btn.isConnected) {
              return;
            }
            delete btn.dataset.error;
            btn.title = SPEAK_LABEL;
            btn.setAttribute("aria-label", SPEAK_LABEL);
          }, ERROR_DISPLAY_MS);
        }
      }}
    >
      <span class="chat-speak-btn__icon" aria-hidden="true">
        <span class="chat-speak-btn__icon-speak">${icons.speaker}</span>
        <span class="chat-speak-btn__icon-check">${icons.check}</span>
      </span>
    </button>
  `;
}
