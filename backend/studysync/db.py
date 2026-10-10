import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


DEFAULT_SETTINGS = {
    "student_name": "",
    "student_email": "",
    "student_tz": "UTC",
    "max_study_min_per_day": 180,
    "plan_horizon_days": 7,
    "mail_lookback_days": 30,
    "calendar_read_only": True,
    "notify_webhook_url": "",
    "last_gmail_sync": None,
    "study_windows": {
        "0": {"start": "17:00", "end": "20:00"},
        "1": {"start": "17:00", "end": "20:00"},
        "2": {"start": "17:00", "end": "20:00"},
        "3": {"start": "17:00", "end": "20:00"},
        "4": {"start": "17:00", "end": "20:00"},
        "5": {"start": "09:00", "end": "12:00"},
        "6": None,
    },
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY, subject TEXT NOT NULL, sender TEXT NOT NULL,
    received_at TEXT NOT NULL, body_preview TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT NOT NULL,
    key_points TEXT NOT NULL, topics TEXT NOT NULL, action_items TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    date TEXT, time TEXT, end_date TEXT, end_time TEXT, location TEXT,
    confidence REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL,
    severity TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, related_item_id TEXT, source_type TEXT, source_id TEXT
);
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, horizon_days INTEGER NOT NULL,
    total_sessions INTEGER NOT NULL, total_study_minutes INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, title TEXT NOT NULL, subject TEXT NOT NULL,
    date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    phase TEXT NOT NULL, rationale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned'
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1), account_email TEXT NOT NULL,
    encrypted_credentials BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY, level TEXT NOT NULL, message TEXT NOT NULL,
    created_at TEXT NOT NULL, context TEXT
);
CREATE INDEX IF NOT EXISTS items_date_idx ON items(date);
CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_plan_date_idx ON sessions(plan_id, date);
"""


def database_path():
    configured = os.getenv("STUDYSYNC_DB_PATH", "data/studysync.sqlite3")
    path = Path(configured)
    return path if path.is_absolute() else Path(__file__).resolve().parents[1] / path


@contextmanager
def connect():
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize():
    with connect() as db:
        db.executescript(SCHEMA)
        db.execute(
            "INSERT OR IGNORE INTO settings (id, data) VALUES (1, ?)",
            (json.dumps(DEFAULT_SETTINGS),),
        )


def settings(db):
    row = db.execute("SELECT data FROM settings WHERE id = 1").fetchone()
    return {**DEFAULT_SETTINGS, **json.loads(row["data"])} if row else dict(DEFAULT_SETTINGS)


def save_settings(db, value):
    db.execute(
        "INSERT INTO settings (id, data) VALUES (1, ?) "
        "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        (json.dumps(value),),
    )


def item_dict(row):
    result = dict(row)
    result["confidence"] = float(result["confidence"])
    return result


def note_dict(db, row):
    result = dict(row)
    for key in ("key_points", "topics", "action_items"):
        result[key] = json.loads(result[key])
    result["extracted_items"] = [
        item_dict(item)
        for item in db.execute(
            "SELECT * FROM items WHERE source_type = 'note' AND source_id = ? ORDER BY created_at",
            (result["id"],),
        )
    ]
    return result


def log(db, level, message, context=None):
    from datetime import datetime, timezone
    from uuid import uuid4

    db.execute(
        "INSERT INTO logs (id, level, message, created_at, context) VALUES (?, ?, ?, ?, ?)",
        (
            str(uuid4()),
            level,
            message,
            datetime.now(timezone.utc).isoformat(),
            json.dumps(context) if context is not None else None,
        ),
    )
