from datetime import datetime

from flask import Blueprint, jsonify, request

from .. import db as store


settings_bp = Blueprint("settings", __name__, url_prefix="/api")


@settings_bp.get("/settings")
def get_settings():
    with store.connect() as db:
        return jsonify(store.settings(db))


@settings_bp.patch("/settings")
def patch_settings():
    payload = request.get_json(silent=True) or {}
    with store.connect() as db:
        current = store.settings(db)
        for key in ("student_name", "student_email", "student_tz", "calendar_read_only", "notify_webhook_url"):
            if key in payload:
                current[key] = payload[key]
        for key, lower, upper in (
            ("max_study_min_per_day", 30, 720),
            ("plan_horizon_days", 1, 90),
            ("mail_lookback_days", 1, 365),
        ):
            if key in payload:
                try:
                    value = int(payload[key])
                except (TypeError, ValueError):
                    return jsonify({"error": f"{key} must be a whole number."}), 400
                if not lower <= value <= upper:
                    return jsonify({"error": f"{key} must be between {lower} and {upper}."}), 400
                current[key] = value
        if "study_windows" in payload:
            if not isinstance(payload["study_windows"], dict):
                return jsonify({"error": "study_windows must be an object keyed by weekday."}), 400
            for day, window in payload["study_windows"].items():
                if day not in {str(index) for index in range(7)}:
                    return jsonify({"error": f"Invalid weekday: {day}."}), 400
                if window is not None:
                    try:
                        start = datetime.strptime(window["start"], "%H:%M")
                        end = datetime.strptime(window["end"], "%H:%M")
                        if end <= start:
                            raise ValueError
                    except (KeyError, TypeError, ValueError):
                        return jsonify({"error": f"Invalid study window for weekday {day}."}), 400
            current["study_windows"].update(payload["study_windows"])
        store.save_settings(db, current)
    return jsonify(current)
