"""Audio processing utilities for chunking audio files."""

import os
from pathlib import Path
from typing import List
from pydub import AudioSegment
from .config import CHUNK_DURATION, OUTPUTS_DIR, ALLOWED_EXTENSIONS


def validate_audio_file(file_path: str) -> bool:
    """
    Validate that the file exists and has an allowed extension.

    Args:
        file_path: Path to audio file

    Returns:
        True if file is valid, raises ValueError otherwise
    """
    path = Path(file_path)

    if not path.exists():
        raise ValueError(f"File does not exist: {file_path}")

    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"File type {path.suffix} not supported. "
            f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    return True


def split_audio(file_path: str, chunk_duration: int = CHUNK_DURATION) -> List[str]:
    """
    Split audio file into chunks of specified duration.

    Args:
        file_path: Path to the input audio file
        chunk_duration: Duration of each chunk in seconds (default from config)

    Returns:
        List of paths to chunk files

    Raises:
        ValueError: If file is invalid or processing fails
    """
    # Validate input file
    validate_audio_file(file_path)

    # Load audio file (PyDub automatically handles various formats via ffmpeg)
    try:
        audio = AudioSegment.from_file(file_path)
    except Exception as e:
        raise ValueError(f"Failed to load audio file: {str(e)}")

    # Calculate chunk size in milliseconds
    chunk_size_ms = chunk_duration * 1000

    # Split audio into chunks
    chunks = []
    chunk_paths = []

    for i, start_ms in enumerate(range(0, len(audio), chunk_size_ms)):
        end_ms = min(start_ms + chunk_size_ms, len(audio))
        chunk = audio[start_ms:end_ms]
        chunks.append(chunk)

        # Export chunk as WAV for compatibility with Deepgram
        chunk_filename = f"chunk_{i:04d}.wav"
        chunk_path = OUTPUTS_DIR / chunk_filename

        try:
            chunk.export(
                chunk_path,
                format="wav",
                parameters=["-ar", "16000", "-ac", "1"]  # 16kHz mono
            )
            chunk_paths.append(str(chunk_path))
        except Exception as e:
            # Clean up any created chunks on failure
            cleanup_chunks(chunk_paths)
            raise ValueError(f"Failed to export chunk {i}: {str(e)}")

    return chunk_paths


def cleanup_chunks(chunk_paths: List[str]) -> None:
    """
    Delete chunk files after processing.

    Args:
        chunk_paths: List of paths to chunk files to delete
    """
    for chunk_path in chunk_paths:
        try:
            path = Path(chunk_path)
            if path.exists():
                path.unlink()
        except Exception as e:
            print(f"Warning: Failed to delete chunk {chunk_path}: {str(e)}")


def get_audio_duration(file_path: str) -> float:
    """
    Get the duration of an audio file in seconds.

    Args:
        file_path: Path to the audio file

    Returns:
        Duration in seconds
    """
    validate_audio_file(file_path)

    try:
        audio = AudioSegment.from_file(file_path)
        return len(audio) / 1000.0  # Convert ms to seconds
    except Exception as e:
        raise ValueError(f"Failed to get audio duration: {str(e)}")
