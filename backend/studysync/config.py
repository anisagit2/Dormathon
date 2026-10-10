import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]


def configure_app(app, test_config=None):
    load_dotenv(BACKEND_DIR / ".env")
    app.config.update(
        SECRET_KEY=os.getenv("APP_SECRET_KEY") or os.urandom(32),
        MAX_CONTENT_LENGTH=26 * 1024 * 1024,
        FRONTEND_URL=os.getenv("FRONTEND_URL", "http://localhost:3000"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if test_config:
        app.config.update(test_config)
