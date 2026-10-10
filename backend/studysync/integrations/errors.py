class ProviderError(RuntimeError):
    """An expected configuration or upstream provider failure."""


class EmptyTranscriptionError(ProviderError):
    """The transcription provider returned no text for an audio upload."""
