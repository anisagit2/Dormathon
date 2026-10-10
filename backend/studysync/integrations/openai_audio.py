import logging
import os

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

from .errors import ProviderError


logger = logging.getLogger("studysync.integrations.openai_audio")
DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"


def transcribe_audio(path):
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ProviderError("Set OPENAI_API_KEY in the backend environment to transcribe audio.")

    client = OpenAI(api_key=api_key, timeout=300)
    try:
        with open(path, "rb") as audio_file:
            result = client.audio.transcriptions.create(
                model=os.getenv("OPENAI_TRANSCRIPTION_MODEL", DEFAULT_TRANSCRIPTION_MODEL),
                file=audio_file,
            )
    except APITimeoutError as error:
        raise ProviderError("OpenAI audio transcription timed out. Try a shorter recording.") from error
    except APIConnectionError as error:
        logger.exception("OpenAI transcription request failed to connect")
        raise ProviderError("Could not connect to OpenAI for audio transcription.") from error
    except APIStatusError as error:
        if error.status_code in (401, 403):
            message = "OpenAI rejected the API key or model access. Check OPENAI_API_KEY and model access."
        elif error.status_code == 429:
            message = "OpenAI rate limit or usage quota was reached. Check your OpenAI billing and limits."
        elif error.status_code >= 500:
            message = "OpenAI transcription is temporarily unavailable. Please try again later."
        else:
            message = f"OpenAI could not transcribe this audio (HTTP {error.status_code})."
        logger.warning("OpenAI transcription API returned HTTP %s", error.status_code)
        raise ProviderError(message) from error

    transcript = getattr(result, "text", "")
    if not isinstance(transcript, str) or not transcript.strip():
        raise ProviderError("OpenAI returned an empty transcript. Check the audio and try again.")
    return transcript.strip()
