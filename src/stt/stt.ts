// Note: To be wired to local Whisper or V4 STT model

export class AudioTranscriber {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.WHISPER_URL || "http://localhost:8000/transcribe";
  }

  /**
   * Transcribes a base64 encoded audio file.
   */
  public async transcribe(audioBase64: string, language: string = "en"): Promise<string> {
    console.log(`[STT] Transcribing audio block (lang: ${language})...`);

    /* V4 logic:
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioBase64, language })
    });
    if (!res.ok) throw new Error('Transcription failed');
    const data = await res.json();
    return data.text;
    */

    return `[Transcriber output placeholder mock] Ah, hello ErnOS. I was wondering if you could pull up my calendar.`;
  }
}

export const stt = new AudioTranscriber();
