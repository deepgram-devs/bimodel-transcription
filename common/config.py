"""Configuration settings for bilingual transcription demo."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
UPLOADS_DIR = PROJECT_ROOT / "uploads"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)

# Audio processing configuration
CHUNK_DURATION = 20  # seconds (configurable 10-30)
FIRST_MINUTE_CHUNKS = 60 // CHUNK_DURATION  # 3 chunks for 20s duration

# Deepgram API settings
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("DEEPGRAM_API_KEY environment variable is required")

ENGLISH_MODEL = "nova-3-medical"
SPANISH_MODEL = "nova-3"
ENGLISH_LANGUAGE = "en"
SPANISH_LANGUAGE = "es"

# File upload limits
MAX_FILE_SIZE_MB = 2000  # 2GB max file size
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}

# Confidence thresholds for UI color coding
HIGH_CONFIDENCE = 0.9
MEDIUM_CONFIDENCE = 0.7
