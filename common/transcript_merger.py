"""Transcript merging logic using word-level confidence scores."""

from typing import List, Dict
from .deepgram_client import extract_words


def merge_transcripts(
    model1_responses: List[Dict], model2_responses: List[Dict]
) -> Dict:
    """
    Merge two model transcripts using word-level confidence scores.

    Algorithm:
    1. Extract all words from both transcripts with timestamps and confidence
    2. Sort by start time to create a timeline
    3. For overlapping words (similar timestamps), select word with higher confidence
       (ties default to model1)
    4. For non-overlapping segments, include words from whichever model has coverage
    5. Generate final transcript with source attribution

    Args:
        model1_responses: List of Deepgram responses from first model
        model2_responses: List of Deepgram responses from second model

    Returns:
        Dict with merged transcript, word array, and metadata
    """
    # Extract all words from both models
    model1_words = []
    for response in model1_responses:
        words = extract_words(response)
        for word in words:
            model1_words.append(
                {
                    "word": word["word"],
                    "start": word["start"],
                    "end": word["end"],
                    "confidence": word["confidence"],
                    "source": "model1",
                }
            )

    model2_words = []
    for response in model2_responses:
        words = extract_words(response)
        for word in words:
            model2_words.append(
                {
                    "word": word["word"],
                    "start": word["start"],
                    "end": word["end"],
                    "confidence": word["confidence"],
                    "source": "model2",
                }
            )

    # Merge words based on timestamps and confidence
    merged_words = _merge_word_arrays(model1_words, model2_words)

    # Generate full transcript text
    transcript = " ".join(w["word"] for w in merged_words)

    # Calculate metadata
    total_words = len(merged_words)
    model1_count = sum(1 for w in merged_words if w["source"] == "model1")
    model2_count = sum(1 for w in merged_words if w["source"] == "model2")
    avg_confidence = (
        sum(w["confidence"] for w in merged_words) / total_words if total_words > 0 else 0.0
    )

    return {
        "transcript": transcript,
        "words": merged_words,
        "metadata": {
            "total_words": total_words,
            "model1_words": model1_count,
            "model2_words": model2_count,
            "avg_confidence": round(avg_confidence, 3),
        },
    }


def _merge_word_arrays(model1_words: List[Dict], model2_words: List[Dict]) -> List[Dict]:
    """
    Merge two word arrays based on timestamps, gaps, and confidence.

    Strategy:
    1. If only one model has transcription at a time → use that model (fill gaps)
    2. If both models transcribe → compare confidence and choose better one (ties default to model1)
    3. Consider a word "overlapping" if timestamps are within 0.15s

    Args:
        model1_words: Words from first model with source='model1'
        model2_words: Words from second model with source='model2'

    Returns:
        Merged and sorted list of words
    """
    merged = []
    i, j = 0, 0  # Pointers for model1 and model2 arrays

    while i < len(model1_words) or j < len(model2_words):
        # Get current words from each array
        word1 = model1_words[i] if i < len(model1_words) else None
        word2 = model2_words[j] if j < len(model2_words) else None

        # Case 1: Only model1 left
        if word1 and not word2:
            merged.append(word1)
            i += 1
            continue

        # Case 2: Only model2 left
        if word2 and not word1:
            merged.append(word2)
            j += 1
            continue

        # Case 3: Both models have words - check for overlap
        overlap_threshold = 0.15  # Words within 150ms are considered overlapping
        time_diff = abs(word1["start"] - word2["start"])

        if time_diff < overlap_threshold:
            # OVERLAPPING: Both models transcribing at same time
            # Choose word with higher confidence (>= ensures model1 wins ties)
            if word1["confidence"] >= word2["confidence"]:
                merged.append(word1)
            else:
                merged.append(word2)
            i += 1
            j += 1
        else:
            # NON-OVERLAPPING: Take whichever comes first chronologically
            # This handles gaps where one model is silent
            if word1["start"] < word2["start"]:
                merged.append(word1)
                i += 1
            else:
                merged.append(word2)
                j += 1

    return merged


def format_transcript_for_display(
    words: List[Dict], include_timestamps: bool = False
) -> str:
    """
    Format merged transcript for display with optional timestamps.

    Args:
        words: List of word dicts from merged transcript
        include_timestamps: Whether to include timestamp annotations

    Returns:
        Formatted transcript string
    """
    if not words:
        return ""

    if not include_timestamps:
        return " ".join(w["word"] for w in words)

    lines = []
    for word in words:
        timestamp = f"[{word['start']:.2f}s]"
        confidence = f"({word['confidence']:.2f})"
        source = f"[{word['source']}]"
        lines.append(f"{timestamp} {word['word']} {confidence} {source}")

    return "\n".join(lines)
