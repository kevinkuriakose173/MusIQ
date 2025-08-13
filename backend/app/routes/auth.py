import secrets
from urllib.parse import urlencode
from flask import Blueprint, current_app, redirect, request, session, jsonify
from ..services.spotify import exchange_code_for_token
from ..utils.tokens import set_tokens, clear_tokens

bp = Blueprint("auth", __name__)
AUTH_URL = "https://accounts.spotify.com/authorize"

@bp.get("/auth/login")
def auth_login():
    client_id = current_app.config["SPOTIFY_CLIENT_ID"]
    redirect_uri = current_app.config["REDIRECT_URI"]
    scopes = "user-read-email user-top-read user-read-recently-played playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state"
    state = secrets.token_urlsafe(24)
    session["oauth_state"] = state
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": scopes,
        "state": state,
        "show_dialog": "false",
    }
    return redirect(f"{AUTH_URL}?{urlencode(params)}")

@bp.get("/auth/callback")
def auth_callback():
    if (err := request.args.get("error")):
        return jsonify({"error": err}), 400
    state = request.args.get("state")
    code = request.args.get("code")
    if not state or state != session.get("oauth_state"):
        return jsonify({"error": "state_mismatch"}), 400
    session.pop("oauth_state", None)
    token = exchange_code_for_token(
        code=code,
        redirect_uri=current_app.config["REDIRECT_URI"],
        client_id=current_app.config["SPOTIFY_CLIENT_ID"],
        client_secret=current_app.config["SPOTIFY_CLIENT_SECRET"],
    )

    
    set_tokens(session, token)
    origin = current_app.config.get("FRONTEND_ORIGIN")
    return redirect(f"{origin}/dashboard") if origin else jsonify({"ok": True})
    
@bp.post("/auth/logout")
def auth_logout():
    clear_tokens(session)
    return {"ok": True}
