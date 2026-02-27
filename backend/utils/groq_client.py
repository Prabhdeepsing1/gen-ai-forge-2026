# backend/utils/groq_client.py
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is not set")

client = Groq(api_key=GROQ_API_KEY)

MODEL_CONFIG = {
    "model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
    "temperature": 0.7,
    "max_tokens": 2048,
    "top_p": 1,
}
