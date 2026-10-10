import json
import os
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

from cryptography.fernet import Fernet
from google.genai.errors import APIError

from studysync import db as store
from studysync.integrations.gmail import read_messages
from studysync.integrations.hive import analyze_transcript, transcribe_audio

TEST_DATA = tempfile.TemporaryDirectory(prefix="studysync-tests-")
os.environ["STUDYSYNC_DB_PATH"] = str(Path(TEST_DATA.name) / "test.sqlite3")
os.environ["TOKEN_ENCRYPTION_KEY"] = Fernet.generate_key().decode("ascii")

from studysync.app import create_app
from studysync.integrations.errors import ProviderError


class StudySyncApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-session-secret",
            "FRONTEND_URL": "http://localhost:3000",
        })
        self.client = self.app.test_client()
        self.client.post("/api/reset")

    def test_health_and_default_settings(self):
        self.assertEqual(self.client.get("/api/health").json, {"ok": True})
        settings = self.client.get("/api/settings").json
        self.assertEqual(settings["plan_horizon_days"], 7)
        self.assertIn("study_windows", settings)
        state = self.client.get("/api/state")
        self.assertEqual(state.status_code, 200, state.json)
        self.assertIsNone(state.json["last_sync"])

    def test_settings_reject_invalid_daily_cap(self):
        response = self.client.patch("/api/settings", json={"max_study_min_per_day": 5})
        self.assertEqual(response.status_code, 400)
        self.assertIn("between 30 and 720", response.json["error"])

    def test_gemini_quota_error_is_converted_to_actionable_provider_error(self):
        client = MagicMock()
        client.models.generate_content.side_effect = APIError(
            429, {"error": {"message": "free-tier quota exceeded"}}
        )
        from studysync.integrations.gemini import _generate_json

        with self.assertRaisesRegex(ProviderError, "usage quota is exhausted"):
            _generate_json(client, "prompt", "email extraction")

    def test_hive_transcribes_audio_with_project_api(self):
        response = MagicMock(ok=True)
        response.json.return_value = {
            "status": {
                "response": {
                    "output": [{"transcript": "The biology project is due Friday."}],
                },
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir, patch.dict(
            os.environ, {"HIVE_SPEECH_API_KEY": "test-speech-key"}
        ), patch("studysync.integrations.hive.requests.post", return_value=response) as post:
            audio_path = Path(temp_dir) / "recording.wav"
            audio_path.write_bytes(b"audio bytes")
            transcript = transcribe_audio(str(audio_path))

        self.assertEqual(transcript, "The biology project is due Friday.")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "token test-speech-key")
        self.assertIn("media", post.call_args.kwargs["files"])
        self.assertEqual(post.call_args.kwargs["timeout"], (15, 240))

    def test_hive_deepseek_parses_streamed_json_and_preserves_transcript(self):
        transcript = "Lecture transcript with a project deadline on October 20."
        result = {
            "summary": "The project is due October 20.",
            "key_points": ["Project deadline: October 20."],
            "topics": ["Project"],
            "action_items": ["Submit the project."],
            "items": [],
        }
        response = MagicMock(ok=True)
        response.__enter__.return_value = response
        response.iter_lines.return_value = [
            f'data: {json.dumps({"choices": [{"delta": {"content": json.dumps(result)}}]})}'.encode(),
            b"data: [DONE]",
        ]
        with patch.dict(os.environ, {"HIVE_LLM_API_KEY": "test-llm-key"}), patch(
            "studysync.integrations.hive.requests.post", return_value=response
        ) as post:
            analysis = analyze_transcript(transcript, "Biology class")

        self.assertEqual(analysis["summary"], result["summary"])
        self.assertEqual(analysis["transcript"], transcript)
        self.assertEqual(
            post.call_args.kwargs["json"]["model"],
            "deepseek-ai/deepseek-v4.1-flash",
        )
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer test-llm-key")

    def test_hive_audio_providers_require_separate_private_keys(self):
        with patch.dict(os.environ, {"HIVE_SPEECH_API_KEY": "", "HIVE_LLM_API_KEY": ""}):
            with self.assertRaisesRegex(ProviderError, "HIVE_SPEECH_API_KEY"):
                transcribe_audio("recording.wav")
            with self.assertRaisesRegex(ProviderError, "HIVE_LLM_API_KEY"):
                analyze_transcript("transcript", "Lecture")

    def test_audio_upload_saves_summary_and_deletes_temporary_audio(self):
        seen_paths = []

        def summarize(path, title):
            seen_paths.append(path)
            self.assertTrue(os.path.isfile(path))
            self.assertEqual(title, "Biology lecture")
            return {
                "summary": "Cell division and the project timeline.",
                "transcript": "The class discussed mitosis.",
                "key_points": ["Mitosis has four stages."],
                "topics": ["Cell division"],
                "action_items": ["Review mitosis"],
                "items": [{
                    "type": "deadline",
                    "title": "Cell biology project",
                    "date": "2099-01-10",
                    "confidence": 0.95,
                }],
            }

        with patch("studysync.routes.notes.analyze_audio", side_effect=summarize):
            response = self.client.post(
                "/api/notes/audio",
                data={
                    "title": "Biology lecture",
                    "audio": (BytesIO(b"recording"), "lecture.wav"),
                },
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 201, response.json)
        self.assertFalse(os.path.exists(seen_paths[0]))
        self.assertEqual(response.json["key_points"], ["Mitosis has four stages."])
        self.assertEqual(response.json["extracted_items"][0]["date"], "2099-01-10")
        self.assertEqual(len(self.client.get("/api/alerts").json["alerts"]), 1)

    def test_audio_is_deleted_when_hive_processing_fails(self):
        seen_paths = []

        def fail(path, title):
            seen_paths.append(path)
            self.assertTrue(os.path.isfile(path))
            raise ProviderError("Hive processing failed.")

        with patch("studysync.routes.notes.analyze_audio", side_effect=fail):
            response = self.client.post(
                "/api/notes/audio",
                data={"title": "Lecture", "audio": (BytesIO(b"recording"), "lecture.mp3")},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Hive processing failed", response.json["error"])
        self.assertFalse(os.path.exists(seen_paths[0]))

    def test_audio_upload_reports_provider_quota_exhaustion(self):
        with patch(
            "studysync.routes.notes.analyze_audio",
            side_effect=ProviderError(
                "Hive usage quota is exhausted for the configured model."
            ),
        ):
            response = self.client.post(
                "/api/notes/audio",
                data={"title": "Lecture", "audio": (BytesIO(b"recording"), "lecture.mp3")},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("usage quota is exhausted", response.json["error"])

    def test_audio_upload_rejects_unsupported_file_types(self):
        response = self.client.post(
            "/api/notes/audio",
            data={"title": "Lecture", "audio": (BytesIO(b"not audio"), "lecture.exe")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 415)

    def test_audio_upload_cors_allows_configured_frontend_preflight(self):
        response = self.client.options(
            "/api/notes/audio",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["Access-Control-Allow-Origin"],
            "http://localhost:3000",
        )
        self.assertEqual(response.headers["Access-Control-Allow-Methods"], "POST, OPTIONS")
        self.assertEqual(response.headers["Access-Control-Allow-Headers"], "Content-Type")

    def test_audio_upload_cors_rejects_unconfigured_origin(self):
        response = self.client.options(
            "/api/notes/audio",
            headers={
                "Origin": "https://attacker.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)

    def test_weekly_plan_uses_saved_note_and_deadline(self):
        planned_date = (date.today() + timedelta(days=3)).isoformat()
        with patch(
            "studysync.routes.notes.analyze_text",
            return_value={
                "summary": "Review derivatives.",
                "transcript": "Lecture transcript.",
                "key_points": ["Chain rule"],
                "items": [{
                    "type": "exam", "title": "Calculus exam", "date": planned_date,
                    "confidence": 0.9,
                }],
            },
        ):
            note = self.client.post(
                "/api/notes", json={"title": "Calculus review", "content": "Exam details"}
            )
        self.assertEqual(note.status_code, 201, note.json)

        settings = self.client.get("/api/settings").json
        settings["plan_horizon_days"] = 7
        settings["study_windows"] = {
            str(day): {"start": "09:00", "end": "18:00"} for day in range(7)
        }
        self.client.patch("/api/settings", json=settings)
        plan_response = self.client.post("/api/plan/generate", json={})
        self.assertEqual(plan_response.status_code, 201, plan_response.json)
        plan = plan_response.json
        self.assertGreaterEqual(plan["total_sessions"], 1)
        self.assertTrue(any("Calculus exam" in item["title"] for item in plan["sessions"]))

    def test_gmail_sync_reports_missing_connection(self):
        response = self.client.post("/api/sync")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Connect a Google account", response.json["error"])

    def test_gmail_search_query_narrows_messages_with_configured_keywords(self):
        service = MagicMock()
        service.users.return_value.messages.return_value.list.return_value.execute.return_value = {
            "messages": [],
        }
        with patch.dict(os.environ, {"GMAIL_SEARCH_QUERY": '{quiz exam "room change"}'}), patch(
            "studysync.integrations.gmail.get_service", return_value=service
        ):
            with store.connect() as db:
                self.assertEqual(read_messages(db, 30), [])

        service.users.return_value.messages.return_value.list.assert_called_once_with(
            userId="me",
            q='newer_than:30d {quiz exam "room change"}',
            maxResults=100,
        )

    def test_manual_gmail_sync_creates_source_linked_alerts(self):
        message = {
            "id": "gmail-message-id",
            "subject": "Room change for Tuesday",
            "sender": "lecturer@example.edu",
            "received_at": "2026-01-01T08:00:00+00:00",
            "body": "Our Tuesday class will be in room 204.",
            "body_preview": "Our Tuesday class will be in room 204.",
            "is_read": False,
        }
        analysis = {
            "relevant": True,
            "items": [{
                "type": "timetable_change",
                "title": "Tuesday class moved to room 204",
                "description": "The venue has changed.",
                "date": "2026-01-06",
                "time": "10:00",
                "location": "Room 204",
                "confidence": 0.97,
            }],
        }
        with patch("studysync.services.gmail_sync.read_gmail_messages", return_value=[message]), patch(
            "studysync.services.gmail_sync.analyze_email", return_value=analysis
        ):
            response = self.client.post("/api/sync")
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["alerts_created"], 1)
        alert = self.client.get("/api/alerts").json["alerts"][0]
        self.assertEqual(alert["source_type"], "email")
        self.assertEqual(alert["source_id"], "gmail-message-id")
        self.assertEqual(alert["category"], "timetable_change")
        self.assertEqual(alert["location"], "Room 204")
        self.assertTrue(self.client.get("/api/gmail/status").json["last_sync"])

    def test_calendar_returns_dated_alert_items_and_filters_rejected_items(self):
        items = [
            ("email-event", "email", "message-1", "timetable_change", "Room change", "2099-01-10", "13:30", "pending"),
            ("note-event", "note", "note-1", "deadline", "Project due", "2099-01-11", None, "pending"),
            ("undated-event", "email", "message-2", "event", "Undated event", None, None, "pending"),
            ("rejected-event", "note", "note-2", "exam", "Rejected exam", "2099-01-12", None, "rejected"),
        ]
        with store.connect() as db:
            for item_id, source_type, source_id, item_type, title, date_value, time_value, status in items:
                db.execute(
                    "INSERT INTO items (id, source_type, source_id, type, title, description, date, time, "
                    "confidence, status, created_at) VALUES (?, ?, ?, ?, ?, '', ?, ?, 0.9, ?, '2099-01-01')",
                    (item_id, source_type, source_id, item_type, title, date_value, time_value, status),
                )
                db.execute(
                    "INSERT INTO alerts (id, title, message, severity, is_read, created_at, related_item_id, "
                    "source_type, source_id) VALUES (?, ?, '', 'info', 0, '2099-01-01', ?, ?, ?)",
                    (f"alert-{item_id}", title, item_id, source_type, source_id),
                )

        response = self.client.get("/api/calendar?from=2099-01-10&to=2099-01-11")
        self.assertEqual(response.status_code, 200, response.json)
        events = response.json["events"]
        self.assertEqual([event["id"] for event in events], ["email-event", "note-event"])
        self.assertFalse(events[0]["all_day"])
        self.assertEqual(events[0]["time"], "13:30")
        self.assertEqual(events[0]["source_type"], "email")
        self.assertTrue(events[1]["all_day"])
        self.assertEqual(events[1]["source_type"], "note")

    def test_calendar_rejects_invalid_date_ranges(self):
        invalid_date = self.client.get("/api/calendar?from=not-a-date")
        self.assertEqual(invalid_date.status_code, 400)
        self.assertIn("YYYY-MM-DD", invalid_date.json["error"])

        reversed_range = self.client.get("/api/calendar?from=2099-01-12&to=2099-01-10")
        self.assertEqual(reversed_range.status_code, 400)

    def test_google_connect_reports_missing_local_oauth_configuration(self):
        with patch.dict(
            os.environ,
            {
                "GOOGLE_OAUTH_CLIENT_SECRETS_JSON": "",
                "GOOGLE_OAUTH_CLIENT_SECRETS_FILE": str(Path(TEST_DATA.name) / "missing-credentials.json"),
            },
        ):
            response = self.client.get("/auth/google/start")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Google OAuth credentials were not found", response.json["error"])

    def test_google_connect_accepts_oauth_client_json_from_environment(self):
        client_config = {"web": {"client_id": "test-client", "client_secret": "test-secret"}}
        with patch.dict(
            os.environ,
            {
                "GOOGLE_OAUTH_CLIENT_SECRETS_JSON": json.dumps(client_config),
                "GOOGLE_OAUTH_REDIRECT_URI": "https://api.example.test/auth/google/callback",
            },
        ), patch("studysync.integrations.google_auth.Flow.from_client_config") as from_client_config:
            flow = from_client_config.return_value
            flow.authorization_url.return_value = ("https://accounts.google.test/authorize", "test-state")
            response = self.client.get("/auth/google/start")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, "https://accounts.google.test/authorize")
        from_client_config.assert_called_once_with(
            client_config,
            scopes=[
                "openid",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/gmail.readonly",
            ],
            state=None,
        )
        self.assertEqual(flow.redirect_uri, "https://api.example.test/auth/google/callback")

    def test_google_callback_uses_forwarded_https_scheme(self):
        flow = MagicMock()
        flow.credentials = object()
        with self.client.session_transaction() as session:
            session["google_oauth_state"] = "test-state"
        with patch("studysync.routes.google.oauth_flow", return_value=flow), patch(
            "studysync.routes.google.build"
        ) as build, patch("studysync.routes.google.store_credentials"):
            build.return_value.userinfo.return_value.get.return_value.execute.return_value = {
                "email": "student@example.com",
            }
            response = self.client.get(
                "/auth/google/callback?state=test-state&code=test-code",
                headers={"X-Forwarded-Proto": "https"},
            )

        self.assertEqual(response.status_code, 302, response.get_data(as_text=True))
        authorization_response = flow.fetch_token.call_args.kwargs["authorization_response"]
        self.assertTrue(authorization_response.startswith("https://"))

    def test_google_connect_rejects_invalid_oauth_client_json(self):
        with patch.dict(
            os.environ,
            {"GOOGLE_OAUTH_CLIENT_SECRETS_JSON": '{"web":'},
        ):
            response = self.client.get("/auth/google/start")
        self.assertEqual(response.status_code, 503)
        self.assertIn("must contain valid JSON", response.json["error"])


if __name__ == "__main__":
    unittest.main()
