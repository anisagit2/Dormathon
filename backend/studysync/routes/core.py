import os

from flask import Blueprint, jsonify

from .. import db as store
from ..integrations.google_auth import GOOGLE_SCOPES
from ..services.domain import mail_status


core_bp = Blueprint("core", __name__, url_prefix="/api")


@core_bp.get("/health")
def health():
    return jsonify({"ok": True})


@core_bp.get("/state")
def state():
    with store.connect() as db:
        unread = db.execute("SELECT COUNT(*) FROM alerts WHERE is_read = 0").fetchone()[0]
        note_count = db.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        email_count = db.execute("SELECT COUNT(*) FROM emails").fetchone()[0]
        active_sessions = db.execute(
            "SELECT COUNT(*) FROM sessions s JOIN plans p ON s.plan_id = p.id "
            "WHERE p.id = (SELECT id FROM plans ORDER BY created_at DESC LIMIT 1) AND s.status = 'planned'"
        ).fetchone()[0]
        configured = store.settings(db)
        gmail = mail_status(db)
    return jsonify({
        "emails_count": email_count,
        "notes_count": note_count,
        "pending_proposals": 0,
        "unread_alerts": unread,
        "active_plan_sessions": active_sessions,
        "last_sync": configured.get("last_gmail_sync"),
        "integration_provider": "Gmail" if gmail["connected"] else "Not connected",
        "simulated": False,
    })


@core_bp.get("/integrations")
def integrations():
    with store.connect() as db:
        gmail = mail_status(db)
    return jsonify({
        "google": {
            "provider": "gmail" if gmail["connected"] else "none",
            "label": gmail["email"] or "Connect Google account",
            "connected": gmail["connected"],
            "email": gmail["email"],
            "scopes": GOOGLE_SCOPES,
        },
        "ai": {
            "engine": "gemini" if os.getenv("GEMINI_API_KEY") else "not_configured",
            "label": "Gemini" if os.getenv("GEMINI_API_KEY") else "Gemini API key not configured",
            "simulated": False,
        },
        "transcription": {
            "available": bool(os.getenv("GEMINI_API_KEY")),
            "label": "Gemini audio analysis" if os.getenv("GEMINI_API_KEY") else "Configure Gemini API key",
        },
        "webhook": {"configured": False},
        "mcp_servers": [],
    })
