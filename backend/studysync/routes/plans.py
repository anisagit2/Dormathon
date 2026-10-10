from flask import Blueprint, jsonify, request

from .. import db as store
from ..planner import generate_weekly_plan
from ..services.domain import plan_dict


plans_bp = Blueprint("plans", __name__, url_prefix="/api")
SESSION_STATUSES = {"planned", "done", "skipped"}


@plans_bp.get("/plan")
def get_plan():
    with store.connect() as db:
        row = db.execute("SELECT * FROM plans ORDER BY created_at DESC LIMIT 1").fetchone()
        return jsonify(plan_dict(db, row))


@plans_bp.post("/plan/generate")
def create_plan():
    payload = request.get_json(silent=True) or {}
    requested_horizon = payload.get("horizon_days")
    if requested_horizon is not None:
        try:
            requested_horizon = int(requested_horizon)
        except (TypeError, ValueError):
            return jsonify({"error": "horizon_days must be a whole number between 1 and 90."}), 400
        if not 1 <= requested_horizon <= 90:
            return jsonify({"error": "horizon_days must be between 1 and 90."}), 400
    with store.connect() as db:
        configured = store.settings(db)
        row, _ = generate_weekly_plan(db, configured, requested_horizon)
        plan = plan_dict(db, row)
    return jsonify(plan), 201


@plans_bp.patch("/sessions/<session_id>/status")
def set_session_status(session_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    if status not in SESSION_STATUSES:
        return jsonify({"error": "Status must be planned, done, or skipped."}), 400
    with store.connect() as db:
        cursor = db.execute("UPDATE sessions SET status = ? WHERE id = ?", (status, session_id))
        if cursor.rowcount == 0:
            return jsonify({"error": "Study session not found."}), 404
    return jsonify({"ok": True})
