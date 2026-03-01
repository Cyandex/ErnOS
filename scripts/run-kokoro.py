import sys
import os
import re
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# Kokoro has a 510 phoneme limit. Roughly 1 char ≈ 2 phonemes, so ~200 chars
# is a safe ceiling per chunk. We split on sentence boundaries to keep natural
# prosody, then fall back to clause/word boundaries for long sentences.
MAX_CHUNK_CHARS = 200

def split_into_chunks(text: str) -> list[str]:
    """Split text into chunks that stay under the phoneme limit.
    
    Strategy:
    1. Split on sentence boundaries (. ! ? followed by space or end)
    2. If a sentence exceeds MAX_CHUNK_CHARS, split on clause boundaries (, ; — :)
    3. If a clause still exceeds, hard-split on word boundaries
    """
    # Split on sentence-ending punctuation
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    
    chunks = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        if len(sentence) <= MAX_CHUNK_CHARS:
            chunks.append(sentence)
        else:
            # Split long sentence on clause boundaries
            clauses = re.split(r'(?<=[,;:—–])\s+', sentence)
            current = ""
            for clause in clauses:
                clause = clause.strip()
                if not clause:
                    continue
                if len(current) + len(clause) + 1 <= MAX_CHUNK_CHARS:
                    current = f"{current} {clause}".strip() if current else clause
                else:
                    if current:
                        chunks.append(current)
                    # If single clause exceeds limit, hard-split on words
                    if len(clause) > MAX_CHUNK_CHARS:
                        words = clause.split()
                        current = ""
                        for word in words:
                            if len(current) + len(word) + 1 <= MAX_CHUNK_CHARS:
                                current = f"{current} {word}".strip() if current else word
                            else:
                                if current:
                                    chunks.append(current)
                                current = word
                    else:
                        current = clause
            if current:
                chunks.append(current)
    
    return chunks if chunks else [text[:MAX_CHUNK_CHARS]]


def clean_text(text: str) -> str:
    """Remove markdown symbols and emojis that shouldn't be pronounced."""
    # Remove emojis (basic range)
    text = re.sub(r'[^\w\s.,!?;:\'"()[\]{}\-—–]+', ' ', text)
    # Remove literal asterisks, underscores, and backticks used for markdown
    text = re.sub(r'[*_`~]+', '', text)
    # Condense multiple spaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def main():
    if len(sys.argv) < 3:
        print("Usage: python3.11 run-kokoro.py <output_wav_path> <voice>")
        sys.exit(1)

    output_path = sys.argv[1]
    voice = sys.argv[2]
    
    # Read the full text payload from standard input to avoid OS command-line length limits
    raw_text = sys.stdin.read()
    if not raw_text.strip():
        print("Error: No text provided via stdin")
        sys.exit(1)
        
    text = clean_text(raw_text)

    # Load from the ErnOS 3.0 directory since that's where the models are
    BASE_DIR = os.path.expanduser("~/Desktop/Ernos 3.0")
    MODEL_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "kokoro-v0_19.onnx")
    VOICES_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "voices.json")

    if not os.path.exists(MODEL_PATH):
        print(f"Error: Kokoro model not found at {MODEL_PATH}")
        sys.exit(1)

    try:
        kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    except Exception as e:
        print(f"Exception during Kokoro init with {VOICES_PATH}: {e}")
        # Fallback for newer kokoro-onnx versions that use voices.bin
        VOICES_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "voices.bin")
        if not os.path.exists(VOICES_PATH):
            print(f"Error: Kokoro voices file not found at {VOICES_PATH}")
            sys.exit(1)
        kokoro = Kokoro(MODEL_PATH, VOICES_PATH)

    try:
        # Split text into chunks that respect Kokoro's 510 phoneme limit
        chunks = split_into_chunks(text)
        
        audio_segments = []
        sample_rate = None
        
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            audio, sr = kokoro.create(
                chunk,
                voice=voice,
                speed=1.0,
                lang="en-us"
            )
            audio_segments.append(audio)
            if sample_rate is None:
                sample_rate = sr
        
        if not audio_segments or sample_rate is None:
            print("Error: No audio generated")
            sys.exit(1)
        
        # Concatenate all audio segments with a small silence gap between sentences
        silence_gap = np.zeros(int(sample_rate * 0.15))  # 150ms pause between chunks
        combined = []
        for i, segment in enumerate(audio_segments):
            combined.append(segment)
            if i < len(audio_segments) - 1:
                combined.append(silence_gap)
        
        full_audio = np.concatenate(combined)
        
        # Write to WAV file
        sf.write(output_path, full_audio, sample_rate, format='WAV')
        print(f"OK")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
