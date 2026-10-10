import os
import tempfile
from pathlib import Path

from flask import Blueprint, jsonify, request

from .. import db as store
from ..integrations.errors import ProviderError
from ..integrations.audio import ALLOWED_AUDIO, analyze_audio
from ..integrations.gemini import analyze_text
from ..services.domain import create_note


notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")


@notes_bp.get("")
def list_notes():
    page = max(1, request.args.get("page", 1, type=int))
    per_page = max(1, min(request.args.get("per_page", 20, type=int), 100))
    with store.connect() as db:
        total = db.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        rows = db.execute(
            "SELECT * FROM notes ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (per_page, (page - 1) * per_page),
        ).fetchall()
        results = [store.note_dict(db, row) for row in rows]
    return jsonify({"notes": results, "total": total})


@notes_bp.get("/<note_id>")
def note_detail(note_id):
    with store.connect() as db:
        row = db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            return jsonify({"error": "Meeting note not found."}), 404
        return jsonify(store.note_dict(db, row))


@notes_bp.post("")
def create_text_note():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    content = str(payload.get("content", "")).strip()
    if not title or not content:
        return jsonify({"error": "Title and meeting transcript are required."}), 400
    try:
        analysis = analyze_text(content[:200000], title)
        with store.connect() as db:
            result = create_note(db, title, analysis)
    except ProviderError as error:
        return jsonify({"error": str(error)}), 503
    return jsonify(result), 201


@notes_bp.post("/audio")
def create_audio_note():
    title = request.form.get("title", "").strip()
    uploaded = request.files.get("audio")
    if not title or uploaded is None or not uploaded.filename:
        return jsonify({"error": "Meeting title and audio recording are required."}), 400
    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in ALLOWED_AUDIO:
        return jsonify({"error": f"Unsupported audio format. Use: {', '.join(sorted(ALLOWED_AUDIO))}."}), 415

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="studysync-", suffix=suffix, delete=False) as temp:
            temp_path = temp.name
            uploaded.save(temp)
        if os.path.getsize(temp_path) == 0:
            return jsonify({"error": "The audio recording is empty."}), 400
        analysis = analyze_audio(temp_path, title)
        with store.connect() as db:
            result = create_note(db, title, analysis)
    except ProviderError as error:
        return jsonify({"error": str(error)}), 503
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
    return jsonify(result), 201


@notes_bp.delete("/<note_id>")
def delete_note(note_id):
    with store.connect() as db:
        row = db.execute("SELECT 1 FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            return jsonify({"error": "Meeting note not found."}), 404
        item_ids = [
            item["id"] for item in db.execute(
                "SELECT id FROM items WHERE source_type = 'note' AND source_id = ?", (note_id,)
            )
        ]
        for item_id in item_ids:
            db.execute("DELETE FROM alerts WHERE related_item_id = ?", (item_id,))
        db.execute("DELETE FROM items WHERE source_type = 'note' AND source_id = ?", (note_id,))
        db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return jsonify({"ok": True})
