# Bimodel Transcription Demo

A demonstration of Deepgram's dual-model transcription capabilities with intelligent confidence-based merging. This application showcases how multiple Deepgram models can be run in parallel on the same audio and intelligently combined to produce a superior transcript.

## 🎯 Key Features

### Intelligent Merge Algorithm

The core innovation of this demo is the **gap-aware, confidence-based merge algorithm** that combines transcripts from two models:

1. **Parallel Transcription**: Both models process the entire audio file simultaneously
2. **Word-Level Analysis**: Compares transcripts at the word level using precise timestamps
3. **Smart Selection**: Chooses the best word from each model based on:
   - **Confidence scores** when both models transcribe (ties default to Model 1)
   - **Gap-filling** when only one model transcribes a segment
4. **Complete Coverage**: Ensures no audio is missed by combining strengths of both models

#### How the Merge Algorithm Works

```python
# For each moment in time:

# Case 1: Both models transcribe (overlapping words)
if both_models_have_word:
    # Choose word with higher confidence
    # Model 1 wins ties (>= operator ensures this)
    selected = model1 if model1.confidence >= model2.confidence else model2

# Case 2: Only Model 1 transcribes (gap in Model 2)
elif only_model1_transcribes:
    selected = model1  # Fill the gap

# Case 3: Only Model 2 transcribes (gap in Model 1)
elif only_model2_transcribes:
    selected = model2  # Fill the gap
```

**Key Parameters:**
- **Overlap Threshold**: 150ms (0.15s) - words within this window are considered overlapping
- **Tie-Breaking**: Model 1 wins when confidence scores are equal

### Visual Timeline Interface

- **Three synchronized timeline rows** showing Model 1, Model 2, and merged transcripts
- **Color-coded visualization**:
  - 🟢 **Green**: Model 1 selected (higher confidence or only source)
  - 🔵 **Blue**: Model 2 selected by confidence (both models transcribed, Model 2 had higher confidence)
  - 🟡 **Yellow**: Model 2 selected by gap-filling (only Model 2 transcribed this segment)
- **Audio playback** synchronized with transcript highlighting
- **Time-based positioning** (200px per second) with automatic word layout
- **Interactive scrubber** for navigating through the audio

### Flexible Model Configuration

- **Any Deepgram model**: Nova-3, Nova-3 Medical, Nova-2 variants, etc.
- **Any language combination**: English, Spanish, French, German, Multilingual, etc.
- **Dynamic language filtering**: UI automatically shows only languages supported by selected model
- **Large file support**: Handles files up to 2GB

## 🏗️ Architecture

### Backend (`app.py`)

Flask web application that:
1. Receives audio uploads and model/language configuration
2. Calls Deepgram API with both models **in parallel** (using asyncio)
3. Runs merge algorithm to combine transcripts
4. Returns word-level data with timestamps and confidence scores

### Deepgram Client (`common/deepgram_client.py`)

- Uses **Deepgram Python SDK v5+**
- Implements parallel transcription with `asyncio.gather()`
- Supports all Deepgram models and languages
- Returns Pydantic models converted to dicts

### Merge Algorithm (`common/transcript_merger.py`)

The heart of the demo - implements the intelligent merge logic:

```python
def _merge_word_arrays(model1_words, model2_words):
    """
    Merge two word arrays based on timestamps, gaps, and confidence.

    Strategy:
    1. If only one model has transcription → use that model (fill gaps)
    2. If both models transcribe → compare confidence (model1 wins ties)
    3. Words within 150ms are considered overlapping
    """
    merged = []
    i, j = 0, 0

    while i < len(model1_words) or j < len(model2_words):
        word1 = model1_words[i] if i < len(model1_words) else None
        word2 = model2_words[j] if j < len(model2_words) else None

        # Case 1: Only model1 left (gap-filling)
        if word1 and not word2:
            merged.append(word1)
            i += 1
            continue

        # Case 2: Only model2 left (gap-filling)
        if word2 and not word1:
            merged.append(word2)
            j += 1
            continue

        # Case 3: Both models have words - check for overlap
        time_diff = abs(word1["start"] - word2["start"])

        if time_diff < 0.15:  # Overlapping
            # Choose by confidence (>= ensures model1 wins ties)
            if word1["confidence"] >= word2["confidence"]:
                merged.append(word1)
            else:
                merged.append(word2)
            i += 1
            j += 1
        else:  # Non-overlapping
            # Take whichever comes first (gap-filling)
            if word1["start"] < word2["start"]:
                merged.append(word1)
                i += 1
            else:
                merged.append(word2)
                j += 1

    return merged
```

### Frontend (`static/script.js` & `templates/index.html`)

- **Deepgram Design System** styling for professional UI
- Real-time audio playback with HTML5 `<audio>` element
- Timeline visualization with absolute positioning based on timestamps
- Synchronized scrolling across all three transcript rows
- Dynamic model/language dropdowns populated from Deepgram API

## 📋 Prerequisites

- Python 3.8+
- Deepgram API key ([get one here](https://console.deepgram.com/signup))
- FFmpeg (for audio validation)

## 🚀 Setup

### 1. Clone and Install

```bash
cd bilingual-transcription-demo
pip install -r requirements.txt
```

### 2. Set Environment Variable

```bash
# Linux/Mac
export DEEPGRAM_API_KEY="your-api-key-here"

# Windows PowerShell
$env:DEEPGRAM_API_KEY="your-api-key-here"

# Windows CMD
set DEEPGRAM_API_KEY=your-api-key-here
```

### 3. Run the Application

```bash
python app.py
```

The application will start at `http://localhost:5000`

## 📁 Project Structure

```
bilingual-transcription-demo/
├── app.py                          # Flask application & main orchestration
├── common/
│   ├── audio_processor.py          # Audio validation & duration calculation
│   ├── config.py                   # Configuration & constants
│   ├── deepgram_client.py          # Deepgram API client (SDK v5+)
│   ├── language_detector.py        # Language detection logic
│   └── transcript_merger.py        # ⭐ Core merge algorithm
├── static/
│   ├── script.js                   # Frontend logic & timeline visualization
│   └── style.css                   # Deepgram Design System styling
├── templates/
│   └── index.html                  # Main UI template
├── uploads/                        # Temporary audio file storage
└── requirements.txt                # Python dependencies
```

## 💡 Use Cases

This demonstration showcases several powerful use cases:

1. **Multilingual Content**: Transcribe audio that switches between languages (e.g., English medical terminology in Spanish consultations)

2. **Domain-Specific Enhancement**: Combine general and specialized models (e.g., Nova-3 + Nova-3 Medical) for better accuracy

3. **Maximum Coverage**: Ensure no speech is missed by filling gaps where one model may have struggled

4. **Confidence Optimization**: Automatically select the most confident transcription for each word

5. **Quality Assurance**: Visual comparison of model outputs to understand strengths and weaknesses

## 🎨 UI Highlights

### Upload Section
- Drag-and-drop file upload
- Model and language configuration dropdowns
- Real-time file size display
- Support for WAV, MP3, M4A, FLAC, OGG formats

### Results Section
- **Timeline Row 1**: First model's transcript with color-coded selection indicators
- **Timeline Row 2**: Second model's transcript with color-coded selection indicators
- **Timeline Row 3**: Merged transcript showing final output with color-coded sources
- **Audio Player**: Synchronized playback with word highlighting
- **Timeline Scrubber**: Interactive navigation with visual merge decision indicators
- **Metadata**: Word counts, confidence scores, language detection status
- **Downloads**: Export results as JSON or formatted TXT

### Color Legend
- 🟢 **Green background**: Model 1 word selected in merge
- 🔵 **Blue background**: Model 2 word selected by confidence
- 🟡 **Yellow background**: Model 2 word selected by gap-filling

## 🔧 Technical Details

### API Integration

Uses Deepgram's Pre-recorded Audio API with:
- `smart_format=True` for automatic formatting
- Word-level timestamps for precise alignment
- Confidence scores for each word
- Parallel requests for optimal performance

### Model Name Mapping

The application maps UI-friendly names to Deepgram API model names:

| UI Value | API Model Name |
|----------|----------------|
| `general` | `nova-3` |
| `medical` | `nova-3-medical` |
| `2-general` | `nova-2` |
| `2-medical` | `nova-2-medical` |
| etc. | ... |

### Performance

- **Parallel Processing**: Both models run simultaneously via `asyncio.gather()`
- **Single API Call**: Entire file processed at once (no chunking)
- **Efficient Merge**: O(n+m) time complexity where n and m are word counts

## 📊 Example Output

```json
{
  "filename": "medical_consultation.mp3",
  "duration": 125.4,
  "metadata": {
    "total_words": 342,
    "model1_words": 198,
    "model2_words": 144,
    "avg_confidence": 0.957,
    "language1": "en",
    "language1_display": "English",
    "model1": "medical",
    "model1_display": "Nova-3 Medical",
    "language2": "es",
    "language2_display": "Spanish",
    "model2": "general",
    "model2_display": "Nova-3",
    "language2_detected": true
  },
  "merged_words": [
    {
      "word": "The",
      "start": 0.5,
      "end": 0.7,
      "confidence": 0.99,
      "source": "model1"
    },
    {
      "word": "patient",
      "start": 0.7,
      "end": 1.1,
      "confidence": 0.98,
      "source": "model1"
    },
    ...
  ]
}
```

## 🛠️ Development

### Running in Debug Mode

Debug mode is enabled by default in `app.py`:

```python
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
```

The server will auto-reload on code changes.

### Adding New Models

To add support for new Deepgram models:

1. Add model to the `novaModels` array in `static/script.js`
2. Add API mapping in `common/deepgram_client.py` `model_mapping` dictionary if needed
3. The language filtering will automatically work based on API metadata

## 📝 License

This is a demonstration application for Deepgram's transcription capabilities.

## 🤝 Credits

Built with:
- [Deepgram Python SDK](https://github.com/deepgram/deepgram-python-sdk) (v5+)
- [Flask](https://flask.palletsprojects.com/) web framework
- [Deepgram Design System](https://developers.deepgram.com/docs/design-system) for UI components
- [Font Awesome](https://fontawesome.com/) for icons

---

**Note**: This demo processes files synchronously for simplicity. For production use with large files or high traffic, consider:
- Background job processing (Celery, RQ)
- Result caching (Redis, database)
- Progress tracking via WebSockets
- CDN for audio file delivery
