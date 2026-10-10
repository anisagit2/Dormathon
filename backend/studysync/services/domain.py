import json
from datetime import datetime, timezone
from uuid import uuid4

from .. import db as store
from ..integrations.errors import ProviderError
from ..integrations.gemini import normalize_items


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def validate_date(value):
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except (TypeError, ValueError):
        return None


def summary_fields(analysis):
    def strings(key):
        value = analysis.get(key, [])
        if not isinstance(value, list):
            return []
        return [str(item).strip()[:2000] for item in value if str(item).strip()][:100]

    return {
        "summary": str(analysis.get("summary") or "").strip()[:12000],
        "content": str(analysis.get("transcript") or "").strip()[:500000],
        "key_points": strings("key_points"),
        "topics": strings("topics"),
        "action_items": strings("action_items"),
    }


def store_items(db, items, source_type, source_id):
    normalized = normalize_items(items)
    for item in normalized:
        item["date"] = validate_date(item["date"])
        item["end_date"] = validate_date(item["end_date"])
        item["time"] = item["time"][:5] if item["time"] and len(item["time"]) >= 5 else item["time"]
        item["end_time"] = item["end_time"][:5] if item["end_time"] and len(item["end_time"]) >= 5 else item["end_time"]
        db.execute(
            "INSERT INTO items (id, source_type, source_id, type, title, description, date, time, end_date, "
            "end_time, location, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
            (
                item["id"], source_type, source_id, item["type"], item["title"], item["description"],
                item["date"], item["time"], item["end_date"], item["end_time"], item["location"],
                item["confidence"], utcnow(),
            ),
        )
        create_alert_for_item(db, item, source_type, source_id)
    return normalized


def create_alert_for_item(db, item, source_type, source_id):
    if item["type"] == "unknown":
        return
    severity = (
        "critical" if item["type"] in {"cancellation", "timetable_change"}
        else "warning" if item["type"] in {"exam", "assignment", "deadline"}
        else "info"
    )
    message_parts = [item["description"]] if item["description"] else []
    if item.get("date"):
        schedule = item["date"]
        if item.get("time"):
            schedule += f" at {item['time']}"
        if item.get("location"):
            schedule += f" · {item['location']}"
        message_parts.append(schedule)
    message = " — ".join(message_parts) or "See the source for details."
    db.execute(
        "INSERT INTO alerts (id, title, message, severity, is_read, created_at, related_item_id, source_type, source_id) "
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)",
        (str(uuid4()), item["title"], message, severity, utcnow(), item["id"], source_type, source_id),
    )


def create_note(db, title, analysis):
    fields = summary_fields(analysis)
    if not fields["summary"]:
        raise ProviderError("Gemini returned no meeting summary. Please retry with a clearer recording.")
    note_id = str(uuid4())
    db.execute(
        "INSERT INTO notes (id, title, content, summary, key_points, topics, action_items, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            note_id, title.strip()[:500], fields["content"], fields["summary"],
            json.dumps(fields["key_points"]), json.dumps(fields["topics"]),
            json.dumps(fields["action_items"]), utcnow(),
        ),
    )
    extracted = store_items(db, analysis.get("items", []), "note", note_id)
    row = db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    result = store.note_dict(db, row)
    result["extracted_items"] = extracted
    return result


def plan_dict(db, row):
    if not row:
        return None
    plan = dict(row)
    plan["sessions"] = [
        dict(session_row)
        for session_row in db.execute(
            "SELECT * FROM sessions WHERE plan_id = ? ORDER BY date, start_time",
            (plan["id"],),
        )
    ]
    return plan


def mail_status(db):
    token = db.execute("SELECT account_email FROM oauth_tokens WHERE id = 1").fetchone()
    return {"connected": bool(token), "email": token["account_email"] if token else None}
