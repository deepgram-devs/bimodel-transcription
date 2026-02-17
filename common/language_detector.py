"""Language detection logic for bilingual transcription."""

from typing import List, Dict
from .deepgram_client import extract_transcript_text


def detect_spanish_in_first_minute(spanish_responses: List[Dict]) -> bool:
    """
    Detect if Spanish is present in the first minute of audio.

    Strategy: If ANY chunk from the Spanish model returns a non-empty
    transcript, we consider Spanish to be present.

    Args:
        spanish_responses: List of Deepgram API responses from Spanish model
                          for the first minute of audio

    Returns:
        True if Spanish detected, False otherwise
    """
    for response in spanish_responses:
        transcript = extract_transcript_text(response)
        if transcript.strip():  # Non-empty transcript means Spanish detected
            return True

    return False


def should_use_dual_transcription(
    spanish_responses_first_minute: List[Dict]
) -> bool:
    """
    Determine if dual transcription should be used for the entire audio.

    This is a convenience wrapper around detect_spanish_in_first_minute
    with a more descriptive name for the processing pipeline.

    Args:
        spanish_responses_first_minute: Spanish transcription responses
                                        from first minute

    Returns:
        True if dual transcription should be used, False for English-only
    """
    return detect_spanish_in_first_minute(spanish_responses_first_minute)
