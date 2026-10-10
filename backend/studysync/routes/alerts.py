from flask import Blueprint, jsonify, request

from .. import db as store


alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@alerts_bp.get("")
def list_alerts():
    unread_only = request.args.get("unread") == "1"
    query = (
        "SELECT a.*, i.type AS category, i.date, i.time, i.location "
        "FROM alerts a LEFT JOIN items i ON i.id = a.related_item_id"
    )
    if unread_only:
        query += " WHERE a.is_read = 0"
    query += " ORDER BY a.created_at DESC LIMIT 500"
    with store.connect() as db:
        rows = db.execute(query).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["is_read"] = bool(item["is_read"])
        result.append(item)
    return jsonify({"alerts": result})


@alerts_bp.post("/read")
def mark_alerts_read():
    payload = request.get_json(silent=True) or {}
    ids = payload.get("ids")
    with store.connect() as db:
        if ids is None:
            db.execute("UPDATE alerts SET is_read = 1")
        elif isinstance(ids, list) and all(isinstance(item, str) for item in ids):
            db.executemany("UPDATE alerts SET is_read = 1 WHERE id = ?", [(item,) for item in ids])
        else:
            return jsonify({"error": "ids must be a list of alert IDs."}), 400
    return jsonify({"ok": True})
