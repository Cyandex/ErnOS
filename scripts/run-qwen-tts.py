#!/usr/bin/env python3
"""
Qwen3-TTS Bridge Script for ErnOS.

Usage:
    python3.12 run-qwen-tts.py <output_wav_path> <speaker> [language] [instruct]

Text is read from stdin.
Speaker: Chelsie, Ethan, Ryan, Vivian, Luke, Laura, Aidan
Language: Auto, English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian
Instruct: Optional natural language instruction for voice style/emotion.

Special flags:
    --list-speakers   Print available speakers and exit.
    --list-languages  Print available languages and exit.
"""
import sys
import os
import re

# Suppress noisy warnings before torch import
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

SPEAKERS = {
    "Aiden": "Adult male, English-native, mature and steady",
    "Dylan": "Young adult male, English-native, energetic",
    "Eric": "Adult male, English-native, deep and authoritative",
    "Ono_Anna": "Young adult female, Japanese-native, expressive",
    "Ryan": "Adult male, English-native, calm and measured",
    "Serena": "Young adult female, English-native, warm",
    "Sohee": "Young adult female, Korean-native, clear",
    "Uncle_Fu": "Older male, Chinese-native, warm and wise",
    "Vivian": "Young adult female, Chinese-native, expressive",
}

# Build a lowercase→proper-case lookup so callers can pass any case
_SPEAKER_LOOKUP = {k.lower(): k for k in SPEAKERS}

LANGUAGES = [
    "Auto", "English", "Chinese", "Japanese", "Korean",
    "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
]


def clean_text(text: str) -> str:
    """Remove markdown and emoji that shouldn't be pronounced."""
    text = re.sub(r'[*_`~]+', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def main():
    # Handle discovery flags
    if "--list-speakers" in sys.argv:
        for name, desc in SPEAKERS.items():
            print(f"{name}: {desc}")
        sys.exit(0)

    if "--list-languages" in sys.argv:
        for lang in LANGUAGES:
            print(lang)
        sys.exit(0)

    if len(sys.argv) < 3:
        print("Usage: run-qwen-tts.py <output_wav_path> <speaker> [language] [instruct]", file=sys.stderr)
        sys.exit(1)

    output_path = sys.argv[1]
    speaker = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "Auto"
    instruct = sys.argv[4] if len(sys.argv) > 4 else ""

    # Validate speaker (case-insensitive lookup → proper case for the model)
    speaker_key = speaker.lower()
    if speaker_key not in _SPEAKER_LOOKUP:
        print(f"Error: Unknown speaker '{speaker}'. Available: {', '.join(SPEAKERS.keys())}", file=sys.stderr)
        sys.exit(1)
    speaker = _SPEAKER_LOOKUP[speaker_key]

    # Read text from stdin
    raw_text = sys.stdin.read()
    if not raw_text.strip():
        print("Error: No text provided via stdin", file=sys.stderr)
        sys.exit(1)

    text = clean_text(raw_text)
    if not text:
        print("Error: Text is empty after cleaning", file=sys.stderr)
        sys.exit(1)

    print(f"[qwen-tts] Loading model (speaker={speaker}, lang={language})...", file=sys.stderr)

    import torch
    import soundfile as sf
    from qwen_tts import Qwen3TTSModel

    # Apple Silicon: use MPS with SDPA attention (no flash-attn on Mac)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32
    attn_impl = "sdpa"  # Mac-compatible attention

    print(f"[qwen-tts] Device: {device}, dtype: {dtype}", file=sys.stderr)

    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        device_map=device,
        dtype=dtype,
        attn_implementation=attn_impl,
    )

    print(f"[qwen-tts] Generating speech ({len(text)} chars)...", file=sys.stderr)

    kwargs = {
        "text": text,
        "language": language,
        "speaker": speaker,
    }
    if instruct:
        kwargs["instruct"] = instruct

    wavs, sr = model.generate_custom_voice(**kwargs)

    sf.write(output_path, wavs[0], sr, format='WAV')
    print(f"OK", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
