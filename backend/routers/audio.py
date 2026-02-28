# backend/routers/audio.py
"""Speech-to-text endpoint using Groq Whisper."""

import tempfile
import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from models import User
from utils.auth import get_current_user
from utils.groq_client import client

router = APIRouter(prefix="/audio", tags=["Audio"])


def _detect_ext(content_type: str, filename: str) -> tuple[str, str]:
    """Return (file_extension, clean_mime) from the upload metadata."""
    ct = (content_type or "").split(";")[0].strip().lower()  # strip codecs param

    MIME_MAP = {
        "audio/webm": (".webm", "audio/webm"),
        "video/webm": (".webm", "audio/webm"),
        "audio/wav": (".wav", "audio/wav"),
        "audio/wave": (".wav", "audio/wav"),
        "audio/x-wav": (".wav", "audio/wav"),
        "audio/mp3": (".mp3", "audio/mpeg"),
        "audio/mpeg": (".mp3", "audio/mpeg"),
        "audio/ogg": (".ogg", "audio/ogg"),
        "audio/flac": (".flac", "audio/flac"),
        "audio/mp4": (".m4a", "audio/mp4"),
        "audio/x-m4a": (".m4a", "audio/mp4"),
        "audio/m4a": (".m4a", "audio/mp4"),
        "application/octet-stream": (".webm", "audio/webm"),
    }

    if ct in MIME_MAP:
        return MIME_MAP[ct]

    # Fallback: try to guess from filename extension
    fn = (filename or "").lower()
    for ext_check, (ext, mime) in [
        (".wav", (".wav", "audio/wav")),
        (".mp3", (".mp3", "audio/mpeg")),
        (".ogg", (".ogg", "audio/ogg")),
        (".flac", (".flac", "audio/flac")),
        (".m4a", (".m4a", "audio/mp4")),
        (".webm", (".webm", "audio/webm")),
    ]:
        if fn.endswith(ext_check):
            return ext, mime

    # Default to webm (Chrome's default recording format)
    return ".webm", "audio/webm"


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Receive an audio file, transcribe it via Groq Whisper, return text."""

    ext, clean_mime = _detect_ext(file.content_type, file.filename)

    data = await file.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Audio file is too small or empty")

    try:
        # Send as a tuple (filename, bytes, mime) so the SDK sets the right format
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=(f"recording{ext}", data, clean_mime),
            response_format="verbose_json",
            language="en",
        )

        text = transcription.text.strip() if hasattr(transcription, "text") else str(transcription).strip()

        if not text:
            raise HTTPException(status_code=422, detail="Could not transcribe any speech from the audio")

        return {"text": text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

