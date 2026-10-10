from flask import Blueprint, current_app, jsonify, redirect, request, session
from googleapiclient.discovery import build

from .. import db as store
from ..integrations.errors import ProviderError
from ..integrations.google_auth import GOOGLE_SCOPES, oauth_flow, store_credentials
from ..services.domain import mail_status
from ..services.gmail_sync import sync_gmail


google_bp = Blueprint("google", __name__)


@google_bp.get("/auth/google/start")
def google_start():
    try:
        flow = oauth_flow()
        url, state_value = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
    except ProviderError as error:
        return jsonify({"error": str(error)}), 503
    session["google_oauth_state"] = state_value
    return redirect(url)


@google_bp.get("/auth/google/callback")
def google_callback():
    expected = session.pop("google_oauth_state", None)
    if not expected or request.args.get("state") != expected:
        return jsonify({"error": "Google sign-in state did not match. Please try again."}), 400
    try:
        flow = oauth_flow(state=expected)
        flow.fetch_token(authorization_response=request.url)
        credentials = flow.credentials
        profile = build(
            "oauth2", "v2", credentials=credentials, cache_discovery=False
        ).userinfo().get().execute()
        email = profile.get("email")
        if not email:
            return jsonify({"error": "Google did not return an account email address."}), 502
        with store.connect() as db:
            store_credentials(db, credentials, email)
    except ProviderError as error:
        return jsonify({"error": str(error)}), 503
    return redirect(f"{current_app.config['FRONTEND_URL']}/alerts?gmail=connected")


@google_bp.get("/api/gmail/status")
def gmail_status():
    with store.connect() as db:
        return jsonify({**mail_status(db), "last_sync": store.settings(db).get("last_gmail_sync")})


@google_bp.post("/api/sync")
def sync():
    with store.connect() as db:
        configured = store.settings(db)
        try:
            result = sync_gmail(db, configured)
        except ProviderError as error:
            store.log(db, "error", "Gmail sync failed", {"error": str(error)})
            return jsonify({"error": str(error)}), 503
    return jsonify(result)
