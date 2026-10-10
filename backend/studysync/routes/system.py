import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from .. import db as store


system_bp = Blueprint("system", __name__, url_prefix="/api")


def _calendar_date(value, parameter):
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except (TypeError, ValueError):
        raise ValueError(f"{parameter} must be a date in YYYY-MM-DD format.") from None


@system_bp.get("/calendar")
def calendar():
    try:
        date_from = _calendar_date(request.args.get("from"), "from")
        date_to = _calendar_date(request.args.get("to"), "to")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    if date_from and date_to and date_from > date_to:
        return jsonify({"error": "'from' must be on or before 'to'."}), 400

    conditions = ["i.date IS NOT NULL", "i.status != 'rejected'"]
    parameters = []
    if date_from:
        conditions.append("i.date >= ?")
        parameters.append(date_from)
    if date_to:
        conditions.append("i.date <= ?")
        parameters.append(date_to)

    with store.connect() as db:
        rows = db.execute(
            "SELECT i.*, a.id AS alert_id FROM items i "
            "JOIN alerts a ON a.related_item_id = i.id "
            f"WHERE {' AND '.join(conditions)} "
            "ORDER BY i.date, i.time IS NOT NULL, i.time, i.title",
            parameters,
        ).fetchall()

    events = []
    for row in rows:
        event = store.item_dict(row)
        event["all_day"] = event["time"] is None
        events.append(event)
    return jsonify({"events": events})


@system_bp.get("/proposals")
def proposals():
    return jsonify({"proposals": []})


@system_bp.post("/proposals/<proposal_id>/decide")
@system_bp.post("/proposals/<proposal_id>/apply")
def unavailable_proposal(proposal_id):
    return jsonify({"error": "Calendar proposals are not available in this local Gmail-only setup."}), 501


@system_bp.post("/proposals/apply-approved")
def apply_approved_proposals():
    return jsonify({"error": "Calendar proposals are not available in this local Gmail-only setup."}), 501


@system_bp.get("/log")
def get_log():
    limit = max(1, min(request.args.get("limit", 200, type=int), 1000))
    level = request.args.get("level")
    with store.connect() as db:
        if level:
            rows = db.execute(
                "SELECT * FROM logs WHERE level = ? ORDER BY created_at DESC LIMIT ?", (level, limit)
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    entries = []
    for row in rows:
        entry = dict(row)
        entry["context"] = json.loads(entry["context"]) if entry["context"] else None
        entries.append(entry)
    return jsonify({"entries": entries})


@system_bp.post("/reset")
def reset():
    with store.connect() as db:
        for table in ("sessions", "plans", "alerts", "items", "notes", "emails", "logs"):
            db.execute(f"DELETE FROM {table}")
    return jsonify({"ok": True})
