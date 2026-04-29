from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import speech_recognition as sr
from pydub import AudioSegment
import os
import shutil

app = FastAPI(title="NEO-Z Python Microservice", description="Handles heavy AI and Data Processing")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "NEO-Z Python Microservice is ACTIVE", "modules": ["voice", "data", "rag"]}

@app.post("/api/voice-to-text")
async def process_voice(audio_file: UploadFile = File(...)):
    temp_audio_path = f"temp_{audio_file.filename}"
    wav_audio_path = f"converted_{audio_file.filename}.wav"
    try:
        # 1. Save original audio from browser
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)

        # 2. Convert audio to WAV format (Standard for AI processing)
        audio = AudioSegment.from_file(temp_audio_path)
        audio.export(wav_audio_path, format="wav")

        # 3. Read converted audio and transcribe
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_audio_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)

        # 4. Clean up temp files
        os.remove(temp_audio_path)
        os.remove(wav_audio_path)

        return {"success": True, "text": text}

    except Exception as e:
        if os.path.exists(temp_audio_path): os.remove(temp_audio_path)
        if os.path.exists(wav_audio_path): os.remove(wav_audio_path)
        return {"success": False, "error": str(e)}