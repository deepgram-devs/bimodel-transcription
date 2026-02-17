"""Deepgram API client wrapper for transcription (SDK v5+)."""

import asyncio
from pathlib import Path
from typing import Dict, Tuple
from deepgram import DeepgramClient
from .config import (
    DEEPGRAM_API_KEY,
    ENGLISH_MODEL,
    SPANISH_MODEL,
    ENGLISH_LANGUAGE,
    SPANISH_LANGUAGE,
)


class DeepgramTranscriber:
    """Wrapper for Deepgram transcription API (SDK v5+)."""

    def __init__(self, api_key: str = None):
        """
        Initialize Deepgram client.

        Args:
            api_key: Deepgram API key (defaults to environment variable)
        """
        # SDK v5+ automatically uses DEEPGRAM_API_KEY env var if not provided
        if api_key:
            self.client = DeepgramClient(api_key=api_key)
        else:
            self.client = DeepgramClient()

    def transcribe_chunk_english(self, chunk_path: str) -> Dict:
        """
        Transcribe audio chunk using English medical model.

        Args:
            chunk_path: Path to audio chunk file

        Returns:
            Deepgram API response dict with transcript and word-level data
        """
        with open(chunk_path, "rb") as audio:
            buffer_data = audio.read()

        # SDK v5+ API: listen.v1.media.transcribe_file()
        # Options passed as keyword arguments
        response = self.client.listen.v1.media.transcribe_file(
            request=buffer_data,
            model=ENGLISH_MODEL,
            language=ENGLISH_LANGUAGE,
            smart_format=True,
        )

        # SDK v5 returns a Pydantic model - convert to dict
        return response.model_dump()

    def transcribe_chunk_spanish(self, chunk_path: str) -> Dict:
        """
        Transcribe audio chunk using Spanish model.

        Args:
            chunk_path: Path to audio chunk file

        Returns:
            Deepgram API response dict with transcript and word-level data
        """
        with open(chunk_path, "rb") as audio:
            buffer_data = audio.read()

        # SDK v5+ API: listen.v1.media.transcribe_file()
        response = self.client.listen.v1.media.transcribe_file(
            request=buffer_data,
            model=SPANISH_MODEL,
            language=SPANISH_LANGUAGE,
            smart_format=True,
        )

        # SDK v5 returns a Pydantic model - convert to dict
        return response.model_dump()

    async def _transcribe_chunk_english_async(self, chunk_path: str) -> Dict:
        """Async version of English transcription."""
        # Run synchronous transcription in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_chunk_english, chunk_path)

    async def _transcribe_chunk_spanish_async(self, chunk_path: str) -> Dict:
        """Async version of Spanish transcription."""
        # Run synchronous transcription in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_chunk_spanish, chunk_path)

    def transcribe_chunk_parallel(self, chunk_path: str) -> Tuple[Dict, Dict]:
        """
        Transcribe audio chunk with both English and Spanish models in parallel.

        Args:
            chunk_path: Path to audio chunk file

        Returns:
            Tuple of (english_response, spanish_response)
        """
        async def _parallel():
            english_task = self._transcribe_chunk_english_async(chunk_path)
            spanish_task = self._transcribe_chunk_spanish_async(chunk_path)
            return await asyncio.gather(english_task, spanish_task)

        # Run async tasks
        english_result, spanish_result = asyncio.run(_parallel())
        return english_result, spanish_result

    def transcribe_with_config(self, file_path: str, model: str, language: str) -> Dict:
        """
        Transcribe audio file with specified model and language.

        Args:
            file_path: Path to audio file
            model: Model name (e.g., 'general', 'medical', '2-general')
            language: Language code (e.g., 'en', 'es', 'fr', 'multi')

        Returns:
            Deepgram API response dict
        """
        with open(file_path, "rb") as audio:
            buffer_data = audio.read()

        # Map internal model names to API model names
        model_mapping = {
            'general': 'nova-3',
            'medical': 'nova-3-medical',
            '2-general': 'nova-2',
            '2-medical': 'nova-2-medical',
            '2-meeting': 'nova-2-meeting',
            '2-phonecall': 'nova-2-phonecall',
            '2-voicemail': 'nova-2-voicemail',
            '2-finance': 'nova-2-finance',
            '2-conversationalai': 'nova-2-conversationalai',
            '2-video': 'nova-2-video',
            '2-drive_thru': 'nova-2-drivethru',
        }

        api_model = model_mapping.get(model, model)

        response = self.client.listen.v1.media.transcribe_file(
            request=buffer_data,
            model=api_model,
            language=language,
            smart_format=True,
        )

        return response.model_dump()

    async def _transcribe_with_config_async(self, file_path: str, model: str, language: str) -> Dict:
        """Async version of configurable transcription."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_with_config, file_path, model, language)

    def transcribe_dual_language(
        self, file_path: str, language1: str, model1: str, language2: str, model2: str
    ) -> Tuple[Dict, Dict]:
        """
        Transcribe audio file with two models in parallel.

        Args:
            file_path: Path to audio file
            language1: Language code for first model
            model1: Model name for first model
            language2: Language code for second model
            model2: Model name for second model

        Returns:
            Tuple of (response1, response2)
        """
        async def _parallel():
            task1 = self._transcribe_with_config_async(file_path, model1, language1)
            task2 = self._transcribe_with_config_async(file_path, model2, language2)
            return await asyncio.gather(task1, task2)

        result1, result2 = asyncio.run(_parallel())
        return result1, result2


def extract_transcript_text(response: Dict) -> str:
    """
    Extract transcript text from Deepgram API response.

    Args:
        response: Deepgram API response dict

    Returns:
        Transcript text string
    """
    try:
        return response["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError):
        return ""


def extract_words(response: Dict) -> list:
    """
    Extract word-level data from Deepgram API response.

    Args:
        response: Deepgram API response dict

    Returns:
        List of word dicts with 'word', 'start', 'end', 'confidence' keys
    """
    try:
        return response["results"]["channels"][0]["alternatives"][0]["words"]
    except (KeyError, IndexError):
        return []
