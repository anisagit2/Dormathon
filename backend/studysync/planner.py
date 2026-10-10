import json
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4


def generate_weekly_plan(db, settings, horizon_days=None):
    horizon = max(1, min(int(horizon_days or settings["plan_horizon_days"]), 90))
    today = date.today()
    deadline = today + timedelta(days=horizon - 1)
    extracted = db.execute(
        "SELECT * FROM items WHERE status IN ('pending', 'confirmed') "
        "AND (date IS NULL OR date <= ?) ORDER BY date IS NULL, date, created_at",
        (deadline.isoformat(),),
    ).fetchall()
    notes = db.execute("SELECT id, title, key_points FROM notes ORDER BY created_at DESC").fetchall()
    tasks = []
    for item in extracted:
        item = dict(item)
        if item["type"] not in {"exam", "assignment", "deadline"}:
            continue
        due = date.fromisoformat(item["date"]) if item["date"] else deadline
        if due < today:
            continue
        subject = item["title"].split(" — ", 1)[0].split(":", 1)[0][:80] or "General study"
        due_text = f"before {due.isoformat()}" if item["date"] else "this week"
        if item["type"] == "exam":
            tasks.append({
                "title": f"Review for: {item['title']}", "subject": subject, "due": due,
                "preferred": max(today, due - timedelta(days=4)),
                "phase": "concept_review", "rationale": f"Revisit key concepts {due_text}.",
            })
            if due > today:
                tasks.append({
                    "title": f"Practice for: {item['title']}", "subject": subject, "due": due,
                    "preferred": max(today, due - timedelta(days=1)),
                    "phase": "mock_test", "rationale": f"Check your understanding before {item['title']}.",
                })
        else:
            tasks.append({
                "title": f"Work on: {item['title']}", "subject": subject, "due": due,
                "preferred": max(today, due - timedelta(days=4)),
                "phase": "practice", "rationale": f"Make progress {due_text}.",
            })
            if due > today:
                tasks.append({
                    "title": f"Review: {item['title']}", "subject": subject, "due": due,
                    "preferred": max(today, due - timedelta(days=1)),
                    "phase": "final_review", "rationale": f"Review and finish before {item['title']}.",
                })
    for note in notes:
        points = json.loads(note["key_points"])
        if points:
            tasks.append({
                "title": f"Review: {note['title']}",
                "subject": note["title"][:80],
                "due": deadline,
                "preferred": today,
                "phase": "concept_review",
                "rationale": f"Revisit the lesson points: {points[0]}",
            })

    slots = []
    windows = settings.get("study_windows", {})
    daily_cap = max(30, min(int(settings.get("max_study_min_per_day", 180)), 720))
    for offset in range(horizon):
        day = today + timedelta(days=offset)
        window = windows.get(str(day.weekday()))
        if not window:
            continue
        try:
            start = datetime.combine(day, time.fromisoformat(window["start"]))
            end = datetime.combine(day, time.fromisoformat(window["end"]))
        except (KeyError, ValueError, TypeError):
            continue
        cursor = start
        used = 0
        while cursor + timedelta(minutes=60) <= end and used + 60 <= daily_cap:
            slot_end = cursor + timedelta(minutes=60)
            slots.append((day, cursor.time(), slot_end.time()))
            cursor += timedelta(minutes=75)
            used += 60

    sessions = []
    used_slots = set()
    tasks.sort(key=lambda task: (task["due"], task["preferred"]))
    for task in tasks:
        available = sorted(
            (
                (abs((slot[0] - task["preferred"]).days), slot[0], index, slot)
                for index, slot in enumerate(slots)
                if index not in used_slots and slot[0] <= task["due"]
            ),
            key=lambda candidate: (candidate[0], candidate[1]),
        )
        if not available:
            continue
        _, day, slot_index, (_, start, end) = available[0]
        used_slots.add(slot_index)
        sessions.append({
            "id": str(uuid4()),
            "title": task["title"],
            "subject": task["subject"],
            "date": day.isoformat(),
            "start_time": start.strftime("%H:%M"),
            "end_time": end.strftime("%H:%M"),
            "phase": task["phase"],
            "rationale": task["rationale"],
        })

    plan_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    total_minutes = sum(
        (
            datetime.strptime(session["end_time"], "%H:%M")
            - datetime.strptime(session["start_time"], "%H:%M")
        ).seconds // 60
        for session in sessions
    )
    db.execute(
        "INSERT INTO plans (id, created_at, horizon_days, total_sessions, total_study_minutes) VALUES (?, ?, ?, ?, ?)",
        (plan_id, created_at, horizon, len(sessions), total_minutes),
    )
    for session in sessions:
        db.execute(
            "INSERT INTO sessions (id, plan_id, title, subject, date, start_time, end_time, phase, rationale) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                session["id"], plan_id, session["title"], session["subject"], session["date"],
                session["start_time"], session["end_time"], session["phase"], session["rationale"],
            ),
        )
    return db.execute("SELECT * FROM plans WHERE id = ?", (plan_id,)).fetchone(), sessions
