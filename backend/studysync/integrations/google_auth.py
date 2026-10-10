import json
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from .errors import ProviderError


BACKEND_DIR = Path(__file__).resolve().parents[2]
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.readonly",
]


def _fernet():
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    if not key:
        raise ProviderError("Set TOKEN_ENCRYPTION_KEY in backend/.env before connecting Gmail.")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as error:
        raise ProviderError("TOKEN_ENCRYPTION_KEY must be a valid Fernet key.") from error


def oauth_flow(state=None):
    secret_file = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS_FILE", "credentials.json")
    if not os.path.isabs(secret_file):
        secret_file = BACKEND_DIR / secret_file
    if not os.path.isfile(secret_file):
        raise ProviderError("Google OAuth credentials file was not found in the backend folder.")
    redirect_uri = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
    )
    flow = Flow.from_client_secrets_file(secret_file, scopes=GOOGLE_SCOPES, state=state)
    flow.redirect_uri = redirect_uri
    return flow


def credentials_for(db):
    row = db.execute("SELECT encrypted_credentials FROM oauth_tokens WHERE id = 1").fetchone()
    if not row:
        return None
    try:
        payload = _fernet().decrypt(row["encrypted_credentials"]).decode("utf-8")
        return Credentials.from_authorized_user_info(json.loads(payload), GOOGLE_SCOPES)
    except (InvalidToken, ValueError, TypeError) as error:
        raise ProviderError("Saved Gmail authorization could not be decrypted; reconnect Gmail.") from error


def store_credentials(db, credentials, account_email):
    encrypted = _fernet().encrypt(credentials.to_json().encode("utf-8"))
    db.execute(
        "INSERT INTO oauth_tokens (id, account_email, encrypted_credentials) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET account_email = excluded.account_email, "
        "encrypted_credentials = excluded.encrypted_credentials",
        (account_email, encrypted),
    )
