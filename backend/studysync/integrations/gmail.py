import base64
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

from googleapiclient.discovery import build

from .. import db as store
from .errors import ProviderError
from .google_auth import credentials_for


def get_service(db):
    credentials = credentials_for(db)
    if credentials is None:
        raise ProviderError("Connect a Google account before syncing Gmail.")
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def _decode_body(payload):
    text_parts = []
    html_parts = []

    def visit(part):
        mime_type = part.get("mimeType")
        body = part.get("body", {}).get("data")
        if body and mime_type in {"text/plain", "text/html"}:
            decoded = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode(
                "utf-8", "replace"
            )
            (text_parts if mime_type == "text/plain" else html_parts).append(decoded)
        for child in part.get("parts", []):
            visit(child)

    visit(payload)
    if any(part.strip() for part in text_parts):
        return "\n".join(text_parts).strip()

    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text = []

        def handle_data(self, data):
            self.text.append(data)

    extractor = TextExtractor()
    for html in html_parts:
        extractor.feed(html)
    return "\n".join(extractor.text).strip()


def read_messages(db, lookback_days):
    service = get_service(db)
    result = service.users().messages().list(
        userId="me", q=f"newer_than:{max(1, int(lookback_days))}d", maxResults=100
    ).execute()
    output = []
    for message in result.get("messages", []):
        if db.execute("SELECT 1 FROM emails WHERE id = ?", (message["id"],)).fetchone():
            continue
        detail = service.users().messages().get(
            userId="me", id=message["id"], format="full"
        ).execute()
        headers = {
            header["name"].lower(): header["value"]
            for header in detail.get("payload", {}).get("headers", [])
        }
        try:
            received = parsedate_to_datetime(headers.get("date", "")).astimezone(
                timezone.utc
            ).isoformat()
        except (TypeError, ValueError, OverflowError):
            received = datetime.now(timezone.utc).isoformat()
        body = _decode_body(detail.get("payload", {}))[:20000]
        output.append({
            "id": message["id"],
            "subject": headers.get("subject", "(No subject)")[:500],
            "sender": headers.get("from", "Unknown sender")[:500],
            "received_at": received,
            "body": body,
            "body_preview": body[:500],
            "is_read": "UNREAD" not in detail.get("labelIds", []),
        })
    return output
