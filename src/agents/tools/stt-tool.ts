/**
 * STT (Speech-to-Text) Module — ported from V3 voice/transcriber.py + web/stt.py
 *
 * Provides audio transcription using OpenAI Whisper API.
 * V3 used Google's free speech_recognition lib; V4 uses Whisper for better quality.
 */

import * as fs from "fs";

export interface TranscriptionResult {
  success: boolean;
  text: string;
  durationMs?: number;
  error?: string;
}

/**
 * Transcribes an audio file using OpenAI's Whisper API.
 *
 * Requires OPENAI_API_KEY in the environment.
 * Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
 */
export async function transcribeAudio(params: {
  audioPath: string;
  language?: string;
  model?: string;
}): Promise<TranscriptionResult> {
  const { audioPath, language, model = "whisper-1" } = params;

  if (!fs.existsSync(audioPath)) {
    return { success: false, text: "", error: `Audio file not found: ${audioPath}` };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      text: "",
      error: "No OPENAI_API_KEY configured. STT requires an OpenAI API key for Whisper.",
    };
  }

  console.log(`[STT] Transcribing: ${audioPath}`);

  try {
    const audioBuffer = fs.readFileSync(audioPath);
    const blob = new Blob([audioBuffer]);

    const formData = new FormData();
    formData.append("file", blob, audioPath.split("/").pop() || "audio.wav");
    formData.append("model", model);
    if (language) {
      formData.append("language", language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        text: "",
        error: `Whisper API error (${response.status}): ${errorBody}`,
      };
    }

    const data = (await response.json()) as { text: string; duration?: number };

    console.log(`[STT] ✅ Transcribed: "${data.text.slice(0, 80)}..."`);

    return {
      success: true,
      text: data.text,
      durationMs: data.duration ? data.duration * 1000 : undefined,
    };
  } catch (error) {
    return {
      success: false,
      text: "",
      error: `Transcription failed: ${error}`,
    };
  }
}

/**
 * Audio chunk accumulator for streaming STT.
 * Accumulates PCM chunks and converts to WAV for transcription.
 */
export class AudioAccumulator {
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private sampleRate: number;
  private channels: number;
  private sampleWidth: number;

  constructor(sampleRate = 16000, channels = 1, sampleWidth = 2) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.sampleWidth = sampleWidth;
  }

  addChunk(data: Buffer): void {
    this.chunks.push(data);
    this.totalBytes += data.length;
  }

  clear(): void {
    this.chunks = [];
    this.totalBytes = 0;
  }

  get hasAudio(): boolean {
    const minBytes = (this.sampleRate * this.sampleWidth * this.channels) / 2; // 500ms
    return this.totalBytes >= minBytes;
  }

  get durationMs(): number {
    if (this.totalBytes === 0) return 0;
    return Math.floor(
      (this.totalBytes / (this.sampleRate * this.sampleWidth * this.channels)) * 1000,
    );
  }

  toWavBuffer(): Buffer {
    const pcmData = Buffer.concat(this.chunks);
    const headerSize = 44;
    const wavBuffer = Buffer.alloc(headerSize + pcmData.length);

    // WAV header
    wavBuffer.write("RIFF", 0);
    wavBuffer.writeUInt32LE(36 + pcmData.length, 4);
    wavBuffer.write("WAVE", 8);
    wavBuffer.write("fmt ", 12);
    wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size
    wavBuffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    wavBuffer.writeUInt16LE(this.channels, 22);
    wavBuffer.writeUInt32LE(this.sampleRate, 24);
    wavBuffer.writeUInt32LE(this.sampleRate * this.channels * this.sampleWidth, 28);
    wavBuffer.writeUInt16LE(this.channels * this.sampleWidth, 32);
    wavBuffer.writeUInt16LE(this.sampleWidth * 8, 34);
    wavBuffer.write("data", 36);
    wavBuffer.writeUInt32LE(pcmData.length, 40);
    pcmData.copy(wavBuffer, headerSize);

    return wavBuffer;
  }
}
