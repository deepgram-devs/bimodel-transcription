// Bilingual Transcription Demo - Frontend JavaScript

// State
let currentJobId = null;
let currentResults = null;
let availableModels = null;

// DOM Elements
const uploadForm = document.getElementById('upload-form');
const audioFileInput = document.getElementById('audio-file');
const dropZone = document.getElementById('drop-zone');
const uploadBtn = document.getElementById('upload-btn');

const uploadSection = document.getElementById('upload-section');
const processingSection = document.getElementById('processing-section');
const errorSection = document.getElementById('error-section');
const resultsSection = document.getElementById('results-section');

const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const errorMessage = document.getElementById('error-message');

const metadataContainer = document.getElementById('metadata');

const downloadJsonBtn = document.getElementById('download-json-btn');
const downloadTxtBtn = document.getElementById('download-txt-btn');
const newUploadBtn = document.getElementById('new-upload-btn');

const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const clearFileBtn = document.getElementById('clear-file-btn');

// ========================================
// File Upload Handling
// ========================================

// Handle file input change
audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        displayFileInfo(file);
    }
});

// Clear file button
clearFileBtn.addEventListener('click', () => {
    audioFileInput.value = '';
    fileInfo.style.display = 'none';
    uploadBtn.disabled = true;
    dropZone.style.display = 'block';
});

// Handle form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = audioFileInput.files[0];
    if (!file) {
        showError('Please select an audio file');
        return;
    }

    // Validate file type
    const validTypes = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) {
        showError(`Invalid file type. Supported: ${validTypes.join(', ')}`);
        return;
    }

    // Upload file
    await uploadFile(file);
});

// Drag and drop handling
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        audioFileInput.files = files;
        displayFileInfo(files[0]);
    }
});

// ========================================
// File Info Display
// ========================================

function displayFileInfo(file) {
    // Show file name
    fileName.textContent = file.name;

    // Format file size
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileSize.textContent = `${sizeMB} MB`;

    // Show file info, hide drop zone text
    fileInfo.style.display = 'flex';
    uploadBtn.disabled = false;

    // Add visual feedback to drop zone
    dropZone.classList.add('file-selected');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// Upload and Processing
// ========================================

async function uploadFile(file) {
    try {
        // Show processing section
        showSection(processingSection);
        progressFill.style.width = '10%';
        progressText.textContent = 'Uploading file...';

        // Get selected models and languages
        const language1 = document.getElementById('language1-select').value;
        const model1 = document.getElementById('model1-select').value;
        const language2 = document.getElementById('language2-select').value;
        const model2 = document.getElementById('model2-select').value;

        // Create form data
        const formData = new FormData();
        formData.append('audio_file', file);
        formData.append('language1', language1);
        formData.append('model1', model1);
        formData.append('language2', language2);
        formData.append('model2', model2);

        // Upload file
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }

        currentJobId = data.job_id;

        // If processing completed immediately (demo mode)
        if (data.status === 'completed') {
            await loadResults(currentJobId);
        } else {
            // Poll for status updates
            pollStatus(currentJobId);
        }
    } catch (error) {
        showError(error.message);
    }
}

async function pollStatus(jobId) {
    try {
        const response = await fetch(`/status/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Status check failed');
        }

        // Update progress
        if (data.progress !== undefined) {
            progressFill.style.width = `${data.progress}%`;

            if (data.progress < 50) {
                progressText.textContent = 'Processing first minute...';
            } else {
                progressText.textContent = 'Processing remaining audio...';
            }
        }

        // Check status
        if (data.status === 'completed') {
            await loadResults(jobId);
        } else if (data.status === 'error') {
            throw new Error(data.error || 'Processing failed');
        } else {
            // Continue polling
            setTimeout(() => pollStatus(jobId), 1000);
        }
    } catch (error) {
        showError(error.message);
    }
}

async function loadResults(jobId) {
    try {
        progressText.textContent = 'Loading results...';
        progressFill.style.width = '100%';

        const response = await fetch(`/results/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load results');
        }

        currentResults = data;
        displayResults(data);
    } catch (error) {
        showError(error.message);
    }
}

// ========================================
// Results Display
// ========================================

let currentTranscriptData = null;
let isPlaying = false;
let playbackInterval = null;
let currentTime = 0;
let totalDuration = 0;
let isUpdatingFromScrubber = false;

const model1Timeline = document.getElementById('model1-timeline');
const model2Timeline = document.getElementById('model2-timeline');
const mergedTimeline = document.getElementById('merged-timeline');
const playPauseBtn = document.getElementById('play-pause-btn');
const currentTimeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');
const timelineTrack = document.getElementById('timeline-track');
const timelineProgress = document.getElementById('timeline-progress');
const timelineHandle = document.getElementById('timeline-handle');
const timelineMarkers = document.getElementById('timeline-markers');
const audioPlayer = document.getElementById('audio-player');

function displayResults(data) {
    currentTranscriptData = data;

    // Calculate total duration from merged words
    if (data.merged_words && data.merged_words.length > 0) {
        totalDuration = data.merged_words[data.merged_words.length - 1].end;
    }

    // Load audio file
    if (data.audio_url) {
        audioPlayer.src = data.audio_url;
        audioPlayer.load();
    }

    // Display timeline-based transcripts
    displayTimelineTranscripts(data);

    // Setup timeline scrubber
    setupTimelineScrubber();

    // Display metadata
    displayMetadata(data.metadata);

    // Show results section
    showSection(resultsSection);
}

function displayTimelineTranscripts(data) {
    // Extract words with actual timestamps from API responses
    const model1Words = data.model1_words || data.english_words || [];
    const model2Words = data.model2_words || data.spanish_words || [];

    // Update labels with actual language and model info
    if (data.metadata) {
        const lang1Display = data.metadata.language1_display || data.metadata.language1 || 'Model 1';
        const lang2Display = data.metadata.language2_display || data.metadata.language2 || 'Model 2';
        const model1Display = data.metadata.model1_display || data.metadata.model1 || '';
        const model2Display = data.metadata.model2_display || data.metadata.model2 || '';

        document.getElementById('model1-label').textContent = lang1Display;
        document.getElementById('model1-badge').textContent = model1Display;
        document.getElementById('model2-label').textContent = lang2Display;
        document.getElementById('model2-badge').textContent = model2Display;
    }

    // Render Model 1 timeline with real timestamps
    model1Timeline.innerHTML = renderTimelineWords(model1Words, 'model1');

    // Render Model 2 timeline with real timestamps
    model2Timeline.innerHTML = renderTimelineWords(model2Words, 'model2');

    // Render merged timeline with substitution highlighting
    if (data.merged_words && data.merged_words.length > 0) {
        mergedTimeline.innerHTML = renderMergedTimelineWords(data.merged_words);
    }

    // Setup synchronized scrolling
    setupSyncedScrolling();
}

function renderTimelineWords(words, source) {
    if (!words || words.length === 0) {
        return '<div style="color: var(--color-text-muted); padding: var(--spacing-md);">No transcription</div>';
    }

    // Calculate pixels per second for positioning
    const pixelsPerSecond = 200; // 200px per second of audio for more spacing
    const timelineWidth = totalDuration * pixelsPerSecond;

    // Assign words to vertical lanes to prevent overlap
    const lanes = assignWordsToLanes(words, pixelsPerSecond);
    const maxLanes = Math.max(...lanes) + 1;
    const rowHeight = Math.max(60, maxLanes * 32); // 32px per lane

    let html = `<div style="position: relative; width: ${timelineWidth}px; height: ${rowHeight}px;">`;

    const mergedWords = currentTranscriptData?.merged_words || [];
    const overlapThreshold = 0.15;

    words.forEach((word, idx) => {
        const leftPosition = word.start * pixelsPerSecond;
        const topPosition = lanes[idx] * 32 + 8; // Vertical offset based on lane
        const time = formatTime(word.start);
        const confPercent = (word.confidence * 100).toFixed(0);

        // Determine color based on merge decision
        let backgroundColor = '';
        let borderColor = '';

        if (source === 'model1') {
            // Model 1 words - check if selected in merge
            const inMerge = mergedWords.some(mw =>
                Math.abs(mw.start - word.start) < overlapThreshold && mw.source === 'model1'
            );
            if (inMerge) {
                backgroundColor = 'rgba(19, 239, 149, 0.2)'; // Green
                borderColor = '#13ef95';
            }
        } else if (source === 'model2') {
            // Model 2 words - check if selected and why
            const mergedWord = mergedWords.find(mw =>
                Math.abs(mw.start - word.start) < overlapThreshold && mw.source === 'model2'
            );

            if (mergedWord) {
                // Check if there was a Model 1 word at this time (confidence) or not (gap-filling)
                const model1Words = currentTranscriptData?.model1_words || currentTranscriptData?.english_words || [];
                const hasModel1 = model1Words.some(ew =>
                    Math.abs(ew.start - word.start) < overlapThreshold
                );

                if (hasModel1) {
                    // Confidence-based selection
                    backgroundColor = 'rgba(20, 154, 251, 0.2)'; // Blue
                    borderColor = '#149afb';
                } else {
                    // Gap-filling
                    backgroundColor = 'rgba(254, 200, 75, 0.2)'; // Orange
                    borderColor = '#fec84b';
                }
            }
        }

        const style = `left: ${leftPosition}px; top: ${topPosition}px; transform: none;` +
                     (backgroundColor ? ` background-color: ${backgroundColor}; border: 1px solid ${borderColor};` : '');

        html += `
            <span class="timeline-word"
                  data-start="${word.start}"
                  data-end="${word.end}"
                  style="${style}"
                  onclick="seekToWord(${word.start})">
                ${word.word}
                <span class="timeline-word__time">${time} (${confPercent}%)</span>
            </span>
        `;
    });

    html += '</div>';
    return html;
}

function renderMergedTimelineWords(words) {
    if (!words || words.length === 0) {
        return '<div style="color: var(--color-text-muted); padding: var(--spacing-md);">No transcription</div>';
    }

    // Calculate pixels per second for positioning
    const pixelsPerSecond = 200; // 200px per second of audio for more spacing
    const timelineWidth = totalDuration * pixelsPerSecond;

    // Assign words to vertical lanes to prevent overlap
    const lanes = assignWordsToLanes(words, pixelsPerSecond);
    const maxLanes = Math.max(...lanes) + 1;
    const rowHeight = Math.max(60, maxLanes * 32); // 32px per lane

    let html = `<div style="position: relative; width: ${timelineWidth}px; height: ${rowHeight}px;">`;

    const model1Words = currentTranscriptData?.model1_words || currentTranscriptData?.english_words || [];
    const model2Words = currentTranscriptData?.model2_words || currentTranscriptData?.spanish_words || [];
    const overlapThreshold = 0.15;

    words.forEach((word, idx) => {
        const leftPosition = word.start * pixelsPerSecond;
        const topPosition = lanes[idx] * 32 + 8; // Vertical offset based on lane
        const time = formatTime(word.start);

        // Determine color based on merge decision
        let backgroundColor = '';
        let borderColor = '';

        if (word.source === 'model1') {
            // Model 1 selected
            backgroundColor = 'rgba(19, 239, 149, 0.2)'; // Green
            borderColor = '#13ef95';
        } else if (word.source === 'model2') {
            // Model 2 selected - determine if by confidence or gap-filling
            const hasModel1 = model1Words.some(w =>
                Math.abs(w.start - word.start) < overlapThreshold
            );

            if (hasModel1) {
                // Confidence-based selection (both models transcribed)
                backgroundColor = 'rgba(20, 154, 251, 0.2)'; // Blue
                borderColor = '#149afb';
            } else {
                // Gap-filling (only model2 transcribed)
                backgroundColor = 'rgba(254, 200, 75, 0.2)'; // Yellow
                borderColor = '#fec84b';
            }
        }

        const style = `left: ${leftPosition}px; top: ${topPosition}px; transform: none;` +
                     (backgroundColor ? ` background-color: ${backgroundColor}; border: 1px solid ${borderColor};` : '');

        html += `
            <span class="timeline-word"
                  data-start="${word.start}"
                  data-end="${word.end}"
                  data-source="${word.source}"
                  style="${style}"
                  onclick="seekToWord(${word.start})">
                ${word.word}
                <span class="timeline-word__time">${time} (${word.source})</span>
            </span>
        `;
    });

    html += '</div>';
    return html;
}

function seekToWord(startTime) {
    currentTime = startTime;
    audioPlayer.currentTime = startTime;
    updateTimelinePosition();
    highlightCurrentWords();
}

function setupSyncedScrolling() {
    let isSyncing = false;

    function handleScroll(sourceElement) {
        // Don't sync during playback or when updating from scrubber/playback
        if (isPlaying || isSyncing || isUpdatingFromScrubber) return;

        isSyncing = true;
        const scrollLeft = sourceElement.scrollLeft;

        // Sync all three rows
        if (sourceElement !== model1Timeline) model1Timeline.scrollLeft = scrollLeft;
        if (sourceElement !== model2Timeline) model2Timeline.scrollLeft = scrollLeft;
        if (sourceElement !== mergedTimeline) mergedTimeline.scrollLeft = scrollLeft;

        // Calculate time at center of viewport
        const pixelsPerSecond = 200;
        const centerOffset = sourceElement.clientWidth / 2;
        const timeAtCenter = (scrollLeft + centerOffset) / pixelsPerSecond;

        // Update scrubber to match
        const percentage = Math.min(100, Math.max(0, (timeAtCenter / totalDuration) * 100));
        timelineProgress.style.width = `${percentage}%`;
        timelineHandle.style.left = `${percentage}%`;
        currentTimeDisplay.textContent = formatTime(timeAtCenter);

        // Seek audio to this position
        currentTime = timeAtCenter;
        audioPlayer.currentTime = currentTime;

        isSyncing = false;
    }

    model1Timeline.addEventListener('scroll', () => handleScroll(model1Timeline));
    model2Timeline.addEventListener('scroll', () => handleScroll(model2Timeline));
    mergedTimeline.addEventListener('scroll', () => handleScroll(mergedTimeline));
}

function assignWordsToLanes(words, pixelsPerSecond) {
    // Assign words to vertical lanes to prevent overlap
    // Returns an array of lane numbers (0, 1, 2, etc.) for each word

    const lanes = [];
    const laneEndTimes = []; // Track when each lane becomes available

    const wordSpacing = 5; // Minimum pixels between words

    words.forEach(word => {
        const wordStartPixel = word.start * pixelsPerSecond;
        const wordEndPixel = word.end * pixelsPerSecond;
        const estimatedWordWidth = word.word.length * 8 + 20; // Rough estimate
        const wordEndPosition = wordStartPixel + estimatedWordWidth + wordSpacing;

        // Find the first available lane
        let assignedLane = 0;
        for (let i = 0; i < laneEndTimes.length; i++) {
            if (wordStartPixel >= laneEndTimes[i]) {
                assignedLane = i;
                break;
            }
            assignedLane = i + 1;
        }

        // Update the lane's end time
        laneEndTimes[assignedLane] = wordEndPosition;
        lanes.push(assignedLane);
    });

    return lanes;
}

function analyzeTranscriptSegments() {
    // Analyze merged words to determine merge decision type
    // Returns segments with color coding for visualization

    const segments = [];
    const model1Words = currentTranscriptData.model1_words || currentTranscriptData.english_words || [];
    const model2Words = currentTranscriptData.model2_words || currentTranscriptData.spanish_words || [];
    const mergedWords = currentTranscriptData.merged_words || [];

    const overlapThreshold = 0.15; // Same as merge algorithm

    mergedWords.forEach(mergedWord => {
        // Find if Model 1 had a word at this time
        const hasModel1 = model1Words.some(w =>
            Math.abs(w.start - mergedWord.start) < overlapThreshold
        );

        // Find if Model 2 had a word at this time
        const hasModel2 = model2Words.some(w =>
            Math.abs(w.start - mergedWord.start) < overlapThreshold
        );

        let color, label;

        if (hasModel1 && hasModel2) {
            // Both models transcribed - confidence-based selection
            if (mergedWord.source === 'model2') {
                color = '#149afb'; // Blue - Model 2 chosen by confidence
                label = 'Model 2 selected (higher confidence)';
            } else {
                color = '#13ef95'; // Green - Model 1 chosen by confidence
                label = 'Model 1 selected (higher confidence)';
            }
        } else if (hasModel1 && !hasModel2) {
            // Gap-filling: Only Model 1 transcribed
            color = '#13ef95'; // Green - Model 1 filled gap
            label = 'Model 1 only (gap-filling)';
        } else if (hasModel2 && !hasModel1) {
            // Gap-filling: Only Model 2 transcribed
            color = '#fec84b'; // Orange - Model 2 filled gap
            label = 'Model 2 only (gap-filling)';
        }

        segments.push({
            start: mergedWord.start,
            end: mergedWord.end,
            color: color,
            label: label
        });
    });

    return segments;
}

// ========================================
// Timeline Scrubber
// ========================================

function setupTimelineScrubber() {
    // Set total time display
    totalTimeDisplay.textContent = formatTime(totalDuration);
    currentTimeDisplay.textContent = formatTime(0);

    // Create time markers every 10 seconds
    createTimeMarkers();

    // Setup audio event listeners
    audioPlayer.addEventListener('ended', () => {
        if (isPlaying) {
            togglePlayback();
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        // Use audio duration if available (more accurate than transcript duration)
        if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            totalDuration = audioPlayer.duration;
            totalTimeDisplay.textContent = formatTime(totalDuration);
            createTimeMarkers();
        }
    });

    // Setup playback controls
    playPauseBtn.addEventListener('click', togglePlayback);

    // Setup scrubber interactions
    timelineTrack.addEventListener('click', seekToPosition);

    // Setup draggable handle
    let isDragging = false;

    timelineHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const rect = timelineTrack.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const percentage = (x / rect.width) * 100;
            currentTime = (percentage / 100) * totalDuration;
            audioPlayer.currentTime = currentTime;
            updateTimelinePosition();
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function createTimeMarkers() {
    timelineMarkers.innerHTML = '';

    // First, add color-coded segments showing merge decisions
    if (currentTranscriptData && currentTranscriptData.merged_words) {
        const segments = analyzeTranscriptSegments();
        segments.forEach(segment => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'timeline-segment';
            segmentDiv.style.left = `${(segment.start / totalDuration) * 100}%`;
            segmentDiv.style.width = `${((segment.end - segment.start) / totalDuration) * 100}%`;
            segmentDiv.style.backgroundColor = segment.color;
            segmentDiv.style.opacity = '0.3';
            segmentDiv.title = segment.label;
            timelineMarkers.appendChild(segmentDiv);
        });
    }

    // Then add time markers on top
    const markerInterval = 10; // Every 10 seconds
    for (let time = 0; time <= totalDuration; time += markerInterval) {
        const percentage = (time / totalDuration) * 100;
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.style.left = `${percentage}%`;

        const label = document.createElement('span');
        label.className = 'timeline-marker__label';
        label.textContent = formatTime(time);
        marker.appendChild(label);

        timelineMarkers.appendChild(marker);
    }
}

function togglePlayback() {
    isPlaying = !isPlaying;

    const icon = playPauseBtn.querySelector('i');
    if (isPlaying) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
        audioPlayer.play();
        startPlayback();
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
        audioPlayer.pause();
        stopPlayback();
    }
}

function startPlayback() {
    // Update timeline based on audio currentTime
    playbackInterval = setInterval(() => {
        currentTime = audioPlayer.currentTime;
        updateTimelinePosition();
        highlightCurrentWords();

        // Auto-stop at end
        if (currentTime >= totalDuration) {
            stopPlayback();
            isPlaying = false;
            const icon = playPauseBtn.querySelector('i');
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }, 100);
}

function stopPlayback() {
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
}

function seekToPosition(e) {
    const rect = timelineTrack.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    currentTime = (percentage / 100) * totalDuration;
    audioPlayer.currentTime = currentTime;
    updateTimelinePosition();
    highlightCurrentWords();
}

function updateTimelinePosition() {
    // Update scrubber
    const percentage = (currentTime / totalDuration) * 100;
    timelineProgress.style.width = `${percentage}%`;
    timelineHandle.style.left = `${percentage}%`;
    currentTimeDisplay.textContent = formatTime(currentTime);

    // Scroll timelines to match current time (works during playback or scrubbing)
    const pixelsPerSecond = 200;
    const currentPixelPosition = currentTime * pixelsPerSecond;
    const centerOffset = model1Timeline.clientWidth / 2;
    const scrollPosition = Math.max(0, currentPixelPosition - centerOffset);

    // Set flag to prevent scroll event handlers from firing
    isUpdatingFromScrubber = true;
    model1Timeline.scrollLeft = scrollPosition;
    model2Timeline.scrollLeft = scrollPosition;
    mergedTimeline.scrollLeft = scrollPosition;
    // Use setTimeout to ensure scroll events have been processed
    setTimeout(() => { isUpdatingFromScrubber = false; }, 0);
}

function highlightCurrentWords() {
    // Remove previous active highlights
    document.querySelectorAll('.timeline-word--active').forEach(el => {
        el.classList.remove('timeline-word--active');
    });

    // Highlight words at current time
    document.querySelectorAll('.timeline-word').forEach(wordEl => {
        const start = parseFloat(wordEl.dataset.start);
        const end = parseFloat(wordEl.dataset.end);

        if (currentTime >= start && currentTime <= end) {
            wordEl.classList.add('timeline-word--active');
        }
    });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

function displayMetadata(metadata) {
    const badges = [];

    // Model 2 detection
    const lang2Display = metadata.language2_display || 'Model 2';
    if (metadata.language2_detected || metadata.spanish_detected) {
        badges.push(`
            <div class="badge badge--success">
                <i class="fas fa-check-circle"></i>
                ${lang2Display} Detected
            </div>
        `);
    } else {
        badges.push(`
            <div class="badge">
                <i class="fas fa-info-circle"></i>
                ${metadata.language1_display || 'Model 1'} Only
            </div>
        `);
    }

    // Word counts
    badges.push(`
        <div class="badge">
            <i class="fas fa-hashtag"></i>
            ${metadata.total_words} words total
        </div>
    `);

    const model1Count = metadata.model1_words || metadata.english_words || 0;
    const model2Count = metadata.model2_words || metadata.spanish_words || 0;

    badges.push(`
        <div class="badge">
            ${model1Count} from ${metadata.language1_display || 'Model 1'}
        </div>
    `);

    if (model2Count > 0) {
        badges.push(`
            <div class="badge badge--primary">
                ${model2Count} from ${lang2Display}
            </div>
        `);
    }

    // Average confidence
    const confPercentage = (metadata.avg_confidence * 100).toFixed(1);
    badges.push(`
        <div class="badge">
            <i class="fas fa-chart-line"></i>
            ${confPercentage}% avg confidence
        </div>
    `);

    metadataContainer.innerHTML = badges.join('');
}

// ========================================
// Download Functions
// ========================================

downloadJsonBtn.addEventListener('click', () => {
    if (!currentResults) return;

    const dataStr = JSON.stringify(currentResults, null, 2);
    downloadFile(dataStr, 'transcription-results.json', 'application/json');
});

downloadTxtBtn.addEventListener('click', () => {
    if (!currentResults) return;

    const meta = currentResults.metadata;
    const lang1 = meta.language1_display || meta.language1 || 'Model 1';
    const lang2 = meta.language2_display || meta.language2 || 'Model 2';
    const model1 = meta.model1_display || meta.model1 || '';
    const model2 = meta.model2_display || meta.model2 || '';
    const model1Count = meta.model1_words || meta.english_words || 0;
    const model2Count = meta.model2_words || meta.spanish_words || 0;

    const content = `
=== BIMODEL TRANSCRIPTION RESULTS ===

Filename: ${currentResults.filename}
Duration: ${currentResults.duration.toFixed(2)}s
${lang2} Detected: ${meta.language2_detected || meta.spanish_detected ? 'Yes' : 'No'}

--- ${lang1.toUpperCase()} TRANSCRIPT (${model1}) ---
${currentResults.model1_transcript || currentResults.english_transcript}

--- ${lang2.toUpperCase()} TRANSCRIPT (${model2}) ---
${currentResults.model2_transcript || currentResults.spanish_transcript}

--- MERGED TRANSCRIPT (Confidence-Based) ---
${currentResults.merged_transcript}

--- METADATA ---
Total Words: ${meta.total_words}
${lang1} Words: ${model1Count}
${lang2} Words: ${model2Count}
Average Confidence: ${(meta.avg_confidence * 100).toFixed(1)}%
    `.trim();

    downloadFile(content, 'transcription-results.txt', 'text/plain');
});

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ========================================
// Navigation
// ========================================

newUploadBtn.addEventListener('click', () => {
    // Reset state
    currentJobId = null;
    currentResults = null;
    currentTranscriptData = null;
    uploadForm.reset();

    // Reset file info display
    fileInfo.style.display = 'none';
    uploadBtn.disabled = true;
    dropZone.classList.remove('file-selected');

    // Reset progress
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading file...';

    // Reset playback and audio
    if (isPlaying) {
        togglePlayback();
    }
    audioPlayer.pause();
    audioPlayer.src = '';
    currentTime = 0;
    totalDuration = 0;

    // Show upload section
    showSection(uploadSection);
});

// ========================================
// UI Helpers
// ========================================

function showSection(section) {
    // Hide all sections
    uploadSection.style.display = 'none';
    processingSection.style.display = 'none';
    errorSection.style.display = 'none';
    resultsSection.style.display = 'none';

    // Show target section
    section.style.display = 'block';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(message) {
    errorMessage.textContent = message;
    showSection(errorSection);

    // Auto-hide after 5 seconds and return to upload
    setTimeout(() => {
        showSection(uploadSection);
    }, 5000);
}

// ========================================
// Load Available Models
// ========================================

async function loadAvailableModels() {
    try {
        const response = await fetch('/models');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load models');
        }

        availableModels = data;

        // Build model-to-languages mapping from API data
        const modelLanguages = {};
        if (data.stt) {
            data.stt.forEach(model => {
                if (model.name && model.languages && Array.isArray(model.languages)) {
                    if (!modelLanguages[model.name]) {
                        modelLanguages[model.name] = new Set();
                    }
                    // Add all supported languages for this model
                    model.languages.forEach(lang => {
                        modelLanguages[model.name].add(lang);
                    });
                }
            });
        }
        window.modelLanguages = modelLanguages;

        // Populate language dropdowns from the languages object
        const language1Select = document.getElementById('language1-select');
        const language2Select = document.getElementById('language2-select');

        language1Select.innerHTML = '';
        language2Select.innerHTML = '';

        // Extract and sort languages
        const languageEntries = Object.entries(data.languages || {});

        // Add 'multi' for multilingual support (not in API response)
        languageEntries.push(['multi', 'Multilingual']);

        const sortedLanguages = languageEntries.sort((a, b) =>
            a[1].localeCompare(b[1])
        );

        // Store all languages globally for filtering
        window.allLanguages = sortedLanguages;

        // Populate both language dropdowns
        populateLanguageDropdown(language1Select, 'en');
        populateLanguageDropdown(language2Select, 'es');

        // Hard-coded Nova models in preferred order (values match API names)
        const novaModels = [
            { value: 'general', label: 'Nova-3' },
            { value: 'general', label: 'Nova-3 Multilingual', defaultLang: 'multi' },
            { value: 'medical', label: 'Nova-3 Medical' },
            { value: '2-general', label: 'Nova-2' },
            { value: '2-meeting', label: 'Nova-2 Meeting' },
            { value: '2-phonecall', label: 'Nova-2 Phonecall' },
            { value: '2-finance', label: 'Nova-2 Finance' },
            { value: '2-conversationalai', label: 'Nova-2 Conversational AI' },
            { value: '2-voicemail', label: 'Nova-2 Voicemail' },
            { value: '2-video', label: 'Nova-2 Video' },
            { value: '2-medical', label: 'Nova-2 Medical' },
            { value: '2-drivethru', label: 'Nova-2 Drive-Thru' },
            { value: '2-automotive', label: 'Nova-2 Automotive' }
        ];

        // Populate model dropdowns
        const model1Select = document.getElementById('model1-select');
        const model2Select = document.getElementById('model2-select');

        model1Select.innerHTML = '';
        model2Select.innerHTML = '';

        novaModels.forEach(model => {
            const option1 = document.createElement('option');
            option1.value = model.value;
            option1.textContent = model.label;
            option1.dataset.defaultLang = model.defaultLang || '';
            if (model.value === 'medical' && !model.defaultLang) option1.selected = true;
            model1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = model.value;
            option2.textContent = model.label;
            option2.dataset.defaultLang = model.defaultLang || '';
            if (model.value === 'general' && !model.defaultLang) option2.selected = true;
            model2Select.appendChild(option2);
        });

        // Add event listeners to filter languages based on selected model
        model1Select.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const defaultLang = selectedOption.dataset.defaultLang;
            filterLanguagesByModel(model1Select.value, language1Select);
            // Auto-select default language if specified (e.g., 'multi' for Nova-3 Multilingual)
            if (defaultLang) {
                language1Select.value = defaultLang;
            }
        });

        model2Select.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const defaultLang = selectedOption.dataset.defaultLang;
            filterLanguagesByModel(model2Select.value, language2Select);
            // Auto-select default language if specified
            if (defaultLang) {
                language2Select.value = defaultLang;
            }
        });

        // Apply initial filtering for default selected models
        filterLanguagesByModel(model1Select.value, language1Select);
        filterLanguagesByModel(model2Select.value, language2Select);

    } catch (error) {
        console.error('Failed to load models:', error);
        showError('Failed to load available models. Using defaults.');
    }
}

function populateLanguageDropdown(selectElement, defaultValue) {
    selectElement.innerHTML = '';

    window.allLanguages.forEach(([code, displayName]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = displayName;
        if (code === defaultValue) option.selected = true;
        selectElement.appendChild(option);
    });
}

function filterLanguagesByModel(modelName, languageSelect) {
    const currentValue = languageSelect.value;
    const supportedLanguages = window.modelLanguages[modelName];

    languageSelect.innerHTML = '';

    if (!supportedLanguages || supportedLanguages.size === 0) {
        // If no language data, show all languages
        populateLanguageDropdown(languageSelect, currentValue);
        return;
    }

    // Filter to only supported languages
    let hasCurrentValue = false;
    window.allLanguages.forEach(([code, displayName]) => {
        // Include 'multi' only for Nova-3 (general model)
        const includeMulti = code === 'multi' && modelName === 'general';
        if (supportedLanguages.has(code) || includeMulti) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = displayName;
            if (code === currentValue) {
                option.selected = true;
                hasCurrentValue = true;
            }
            languageSelect.appendChild(option);
        }
    });

    // If current selection is not supported, select first available
    if (!hasCurrentValue && languageSelect.options.length > 0) {
        languageSelect.selectedIndex = 0;
    }
}

// Load models on page load
loadAvailableModels();
