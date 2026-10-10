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
    client_config_json = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS_JSON", "").strip()
    if client_config_json:
        try:
            client_config = json.loads(client_config_json)
        except json.JSONDecodeError as error:
            raise ProviderError("GOOGLE_OAUTH_CLIENT_SECRETS_JSON must contain valid JSON.") from error
        if not isinstance(client_config, dict) or not any(
            isinstance(client_config.get(client_type), dict)
            for client_type in ("web", "installed")
        ):
            raise ProviderError(
                "GOOGLE_OAUTH_CLIENT_SECRETS_JSON must contain a Google web or installed client configuration."
            )
        flow = Flow.from_client_config(client_config, scopes=GOOGLE_SCOPES, state=state)
    else:
        secret_file = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS_FILE", "credentials.json")
        if not os.path.isabs(secret_file):
            secret_file = BACKEND_DIR / secret_file
        if not os.path.isfile(secret_file):
            raise ProviderError(
                "Google OAuth credentials were not found. Set GOOGLE_OAUTH_CLIENT_SECRETS_JSON "
                "or provide credentials.json in the backend folder."
            )
        flow = Flow.from_client_secrets_file(secret_file, scopes=GOOGLE_SCOPES, state=state)

    redirect_uri = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
    )
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
