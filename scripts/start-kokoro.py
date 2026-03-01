import os
import io
import base64
import soundfile as sf
import warnings
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from kokoro_onnx import Kokoro

warnings.filterwarnings("ignore", category=DeprecationWarning)

app = FastAPI(title="Kokoro TTS (OpenAI Compatible)")

# Paths based on ErnOS V3
BASE_DIR = os.path.expanduser("~/Desktop/Ernos 3.0")
MODEL_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "kokoro-v0_19.onnx")
VOICES_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "voices.json") # Default for older kokoro-onnx 

# Fallback voice handling
kokoro = None
try:
    print(f"Loading Kokoro ONNX model from {MODEL_PATH}")
    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    print("Kokoro model loaded successfully.")
except Exception as e:
    print(f"Failed to load Kokoro: {e}")
    # Try alternate path for voices list if available
    try:
        VOICES_PATH = os.path.join(BASE_DIR, "memory", "public", "voice_models", "voices.bin")
        kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
        print("Kokoro model loaded successfully with alternate voices path.")
    except Exception as e2:
         print(f"Still failed: {e2}")

class SpeechRequest(BaseModel):
    model: str
    input: str
    voice: str = "am_michael"
    response_format: str = "mp3"
    speed: float = 1.0

@app.post("/v1/audio/speech")
async def create_speech(request: SpeechRequest):
    if not kokoro:
        raise HTTPException(status_code=500, detail="Kokoro model not initialized")
    
    try:
        # Generate audio
        # kokoro.create returns (audio_array, sample_rate)
        audio, sample_rate = kokoro.create(
            request.input, 
            voice=request.voice, 
            speed=request.speed, 
            lang="en-us"
        )
        
        # Convert numpy array to WAV bytes
        audio_io = io.BytesIO()
        sf.write(audio_io, audio, sample_rate, format='WAV')
        audio_io.seek(0)
        
        # OpenAI compatible endpoint returns raw audio bytes
        return Response(content=audio_io.read(), media_type="audio/wav")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.get("/v1/models")
async def list_models():
    # OpenAI compatible models endpoint
    return {
        "object": "list",
        "data": [
            {
                "id": "kokoro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "openai"
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting Kokoro API server on http://127.0.0.1:8880")
    uvicorn.run(app, host="127.0.0.1", port=8880)
