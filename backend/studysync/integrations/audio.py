from .hive import analyze_transcript
from .openai_audio import transcribe_audio


ALLOWED_AUDIO = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}


def analyze_audio(path, title):
    transcript = transcribe_audio(path)
    return analyze_transcript(transcript, title)
