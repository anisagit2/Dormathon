from flask import Blueprint, jsonify, request

from .. import db as store


emails_bp = Blueprint("emails", __name__, url_prefix="/api/emails")


@emails_bp.get("")
def list_emails():
    page = max(1, request.args.get("page", 1, type=int))
    per_page = max(1, min(request.args.get("per_page", 20, type=int), 100))
    with store.connect() as db:
        total = db.execute("SELECT COUNT(*) FROM emails").fetchone()[0]
        rows = db.execute(
            "SELECT * FROM emails ORDER BY received_at DESC LIMIT ? OFFSET ?",
            (per_page, (page - 1) * per_page),
        ).fetchall()
    return jsonify({"emails": [dict(row) for row in rows], "total": total})


@emails_bp.get("/<email_id>")
def email_detail(email_id):
    with store.connect() as db:
        row = db.execute("SELECT * FROM emails WHERE id = ?", (email_id,)).fetchone()
        if not row:
            return jsonify({"error": "Email not found."}), 404
        result = dict(row)
        result["extracted_items"] = [
            store.item_dict(item)
            for item in db.execute(
                "SELECT * FROM items WHERE source_type = 'email' AND source_id = ?",
                (email_id,),
            )
        ]
    return jsonify(result)
