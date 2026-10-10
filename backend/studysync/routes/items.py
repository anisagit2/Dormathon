from flask import Blueprint, jsonify, request

from .. import db as store


items_bp = Blueprint("items", __name__, url_prefix="/api/items")
ITEM_STATUSES = {"pending", "confirmed", "rejected", "done"}


@items_bp.get("")
def list_items():
    status = request.args.get("status")
    with store.connect() as db:
        if status in ITEM_STATUSES:
            rows = db.execute(
                "SELECT * FROM items WHERE status = ? ORDER BY date", (status,)
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM items ORDER BY date, created_at").fetchall()
    return jsonify({"items": [store.item_dict(row) for row in rows]})


@items_bp.patch("/<item_id>/status")
def update_item_status(item_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    if status not in ITEM_STATUSES:
        return jsonify({"error": "Invalid extracted-item status."}), 400
    with store.connect() as db:
        cursor = db.execute("UPDATE items SET status = ? WHERE id = ?", (status, item_id))
        if cursor.rowcount == 0:
            return jsonify({"error": "Extracted item not found."}), 404
    return jsonify({"ok": True})
