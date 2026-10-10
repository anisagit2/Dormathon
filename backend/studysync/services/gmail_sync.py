import time

from .. import db as store
from ..integrations.errors import ProviderError
from ..integrations.gemini import analyze_email
from ..integrations.gmail import read_messages as read_gmail_messages
from .domain import store_items, utcnow


def sync_gmail(db, configured):
    started = time.perf_counter()
    messages = read_gmail_messages(db, configured["mail_lookback_days"])
    fetched = 0
    extracted = 0
    created_alerts = 0

    for message in messages:
        analysis = analyze_email(message["subject"], message["sender"], message["body"])
        items = store_items(
            db,
            analysis.get("items", []) if analysis.get("relevant") is not False else [],
            "email",
            message["id"],
        )
        db.execute(
            "INSERT INTO emails (id, subject, sender, received_at, body_preview, is_read) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                message["id"], message["subject"], message["sender"], message["received_at"],
                message["body_preview"], int(message["is_read"]),
            ),
        )
        extracted += len(items)
        created_alerts += sum(item["type"] != "unknown" for item in items)
        fetched += 1

    store.log(
        db,
        "info",
        "Gmail sync completed",
        {"emails": fetched, "items": extracted, "alerts": created_alerts},
    )
    configured["last_gmail_sync"] = utcnow()
    store.save_settings(db, configured)
    return {
        "emails_fetched": fetched,
        "emails_new": fetched,
        "items_extracted": extracted,
        "alerts_created": created_alerts,
        "simulated": False,
        "duration_ms": round((time.perf_counter() - started) * 1000),
    }


__all__ = ["ProviderError", "sync_gmail"]
