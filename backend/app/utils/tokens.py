import time
from functools import wraps
from flask import current_app, session, jsonify
from ..services.spotify import refresh_access_token

def set_tokens(session_obj, token_dict):
    session_obj["token"] = {
        "access_token": token_dict["access_token"],
        "refresh_token": token_dict.get("refresh_token"),
        "expires_at": token_dict.get("expires_at"),
        "token_type": token_dict.get("token_type", "Bearer"),
        "scope": token_dict.get("scope", ""),
    }

def clear_tokens(session_obj):
    session_obj.pop("token", None)

def _ensure_fresh_access_token():
    tok = session.get("token")
    if not tok or not tok.get("access_token"):
        return False
    if int(tok.get("expires_at", 0)) <= int(time.time()):
        rt = tok.get("refresh_token")
        if not rt:
            return False
        new_tok = refresh_access_token(
            refresh_token=rt,
            client_id=current_app.config["SPOTIFY_CLIENT_ID"],
            client_secret=current_app.config["SPOTIFY_CLIENT_SECRET"],
        )
        session["token"] = new_tok
    return True

def require_access_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _ensure_fresh_access_token():
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper
