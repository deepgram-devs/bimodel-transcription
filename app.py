"""Flask web application for bilingual transcription demo."""

import os
import uuid
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename

from common.config import (
    UPLOADS_DIR,
    MAX_FILE_SIZE_MB,
    ALLOWED_EXTENSIONS,
)
from common.audio_processor import (
    get_audio_duration,
    validate_audio_file,
)
from common.deepgram_client import (
    DeepgramTranscriber,
    extract_transcript_text,
    extract_words,
)
from common.language_detector import should_use_dual_transcription
from common.transcript_merger import merge_transcripts

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024

# Store processing results in memory (in production, use Redis or database)
processing_results = {}


@app.route("/")
def index():
    """Render main page with upload form."""
    return render_template("index.html")


@app.route("/models")
def get_models():
    """
    Fetch available Deepgram models and languages.

    Returns:
        JSON with available models
    """
    try:
        transcriber = DeepgramTranscriber()
        models = transcriber.client.manage.v1.models.list()
        return jsonify(models.model_dump()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload", methods=["POST"])
def upload():
    """
    Handle file upload and start transcription processing.

    Returns:
        JSON with job_id for polling status
    """
    # Validate file upload
    if "audio_file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["audio_file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Get model and language configuration
    language1 = request.form.get("language1", "en")
    model1 = request.form.get("model1", "nova-3-medical")
    language2 = request.form.get("language2", "es")
    model2 = request.form.get("model2", "nova-3")

    # Validate file extension
    filename = secure_filename(file.filename)
    file_ext = Path(filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return jsonify(
            {
                "error": f"File type {file_ext} not supported. "
                f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            }
        ), 400

    # Save uploaded file
    job_id = str(uuid.uuid4())
    upload_path = UPLOADS_DIR / f"{job_id}_{filename}"
    file.save(upload_path)

    try:
        # Validate audio file
        validate_audio_file(str(upload_path))
        duration = get_audio_duration(str(upload_path))

        # Initialize processing status
        processing_results[job_id] = {
            "status": "processing",
            "progress": 0,
            "filename": filename,
            "duration": duration,
            "audio_path": str(upload_path),
        }

        # Process in background (for production, use Celery or similar)
        # For demo purposes, we'll process synchronously
        result = process_audio(str(upload_path), job_id, language1, model1, language2, model2)

        # Update results
        processing_results[job_id] = {
            "status": "completed",
            "progress": 100,
            "filename": filename,
            "duration": duration,
            "audio_path": str(upload_path),
            **result,
        }

        return jsonify({"job_id": job_id, "status": "completed"}), 200

    except Exception as e:
        processing_results[job_id] = {
            "status": "error",
            "error": str(e),
            "filename": filename,
        }
        # Clean up on error
        if upload_path.exists():
            upload_path.unlink()
        return jsonify({"job_id": job_id, "status": "error", "error": str(e)}), 500


@app.route("/status/<job_id>")
def status(job_id):
    """
    Check processing status for a job.

    Args:
        job_id: Unique job identifier

    Returns:
        JSON with current status
    """
    if job_id not in processing_results:
        return jsonify({"error": "Job not found"}), 404

    return jsonify(processing_results[job_id]), 200


@app.route("/results/<job_id>")
def results(job_id):
    """
    Get final transcription results for a job.

    Args:
        job_id: Unique job identifier

    Returns:
        JSON with all transcripts
    """
    if job_id not in processing_results:
        return jsonify({"error": "Job not found"}), 404

    result = processing_results[job_id]

    if result["status"] != "completed":
        return jsonify({"error": "Job not completed yet"}), 400

    return jsonify(
        {
            "filename": result["filename"],
            "duration": result["duration"],
            "model1_transcript": result["model1_transcript"],
            "model2_transcript": result["model2_transcript"],
            "model1_words": result.get("model1_words", []),
            "model2_words": result.get("model2_words", []),
            # Keep old names for backward compatibility
            "english_transcript": result["model1_transcript"],
            "spanish_transcript": result["model2_transcript"],
            "english_words": result.get("model1_words", []),
            "spanish_words": result.get("model2_words", []),
            "merged_transcript": result["merged_transcript"],
            "merged_words": result["merged_words"],
            "metadata": result["metadata"],
            "audio_url": f"/audio/{job_id}",
        }
    ), 200


@app.route("/audio/<job_id>")
def audio(job_id):
    """
    Serve the audio file for a completed job.

    Args:
        job_id: Unique job identifier

    Returns:
        Audio file
    """
    if job_id not in processing_results:
        return jsonify({"error": "Job not found"}), 404

    result = processing_results[job_id]

    if result["status"] != "completed":
        return jsonify({"error": "Job not completed yet"}), 400

    audio_path = Path(result["audio_path"])
    if not audio_path.exists():
        return jsonify({"error": "Audio file not found"}), 404

    return send_file(audio_path, mimetype="audio/mpeg")


def process_audio(file_path: str, job_id: str, language1: str, model1: str, language2: str, model2: str) -> dict:
    """
    Process audio file with bilingual transcription logic.

    Args:
        file_path: Path to uploaded audio file
        job_id: Job identifier for status updates
        language1: Language code for first model
        model1: Model name for first model
        language2: Language code for second model
        model2: Model name for second model

    Returns:
        Dict with transcription results
    """
    transcriber = DeepgramTranscriber()

    # Update progress
    processing_results[job_id]["progress"] = 10

    # Process entire file with dual transcription
    resp1, resp2 = transcriber.transcribe_dual_language(
        file_path, language1, model1, language2, model2
    )

    processing_results[job_id]["progress"] = 70

    # Detect if second language content exists
    language2_detected = should_use_dual_transcription([resp2])

    # Extract transcripts
    transcript1 = extract_transcript_text(resp1)
    transcript2 = extract_transcript_text(resp2)

    # Extract words with timestamps (no offset needed - full file)
    model1_words = []
    words_data = extract_words(resp1)
    for word in words_data:
        model1_words.append({
            "word": word["word"],
            "start": word["start"],
            "end": word["end"],
            "confidence": word["confidence"],
            "source": "model1"
        })

    model2_words = []
    words_data = extract_words(resp2)
    for word in words_data:
        model2_words.append({
            "word": word["word"],
            "start": word["start"],
            "end": word["end"],
            "confidence": word["confidence"],
            "source": "model2"
        })

    processing_results[job_id]["progress"] = 90

    # Merge transcripts if second language was detected
    if language2_detected:
        merged_result = merge_transcripts([resp1], [resp2])
    else:
        # If no second language, merged is same as first
        merged_result = {
            "transcript": transcript1,
            "words": model1_words,
            "metadata": {
                "total_words": len(model1_words),
                "model1_words": len(model1_words),
                "model2_words": 0,
                "avg_confidence": round(sum(w["confidence"] for w in model1_words) / len(model1_words), 3) if model1_words else 0.0
            }
        }

    # Get display names for languages
    from common.config import UPLOADS_DIR  # Just to check imports work

    # Simple display name mapping
    lang_display = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'multi': 'Multilingual', 'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'
    }
    model_display = {
        'general': 'Nova-3', 'medical': 'Nova-3 Medical',
        '2-general': 'Nova-2', '2-medical': 'Nova-2 Medical'
    }

    return {
        "model1_transcript": transcript1,
        "model2_transcript": transcript2,
        "model1_words": model1_words,
        "model2_words": model2_words,
        "merged_transcript": merged_result["transcript"],
        "merged_words": merged_result["words"],
        "metadata": {
            **merged_result["metadata"],
            "language2_detected": language2_detected,
            "language1": language1,
            "model1": model1,
            "language2": language2,
            "model2": model2,
            "language1_display": lang_display.get(language1, language1.upper()),
            "language2_display": lang_display.get(language2, language2.upper()),
            "model1_display": model_display.get(model1, model1),
            "model2_display": model_display.get(model2, model2),
        }
    }


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
