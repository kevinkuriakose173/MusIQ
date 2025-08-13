import base64, time, requests
from typing import Dict, Any, Optional
from flask import current_app

API_BASE = "https://api.spotify.com/v1"
TOKEN_URL = "https://accounts.spotify.com/api/token"

def _basic_auth_header(client_id: str, client_secret: str):
    raw = f"{client_id}:{client_secret}".encode()
    b64 = base64.b64encode(raw).decode()
    return {"Authorization": f"Basic {b64}", "Content-Type": "application/x-www-form-urlencoded"}

def _raise_for_spotify_error(resp: requests.Response) -> None:
    if not resp.ok:
        ct = resp.headers.get("content-type", "")
        snippet = resp.text[:400]
        raise RuntimeError(f"Spotify {resp.status_code} {resp.reason} | CT={ct} | Body: {snippet}")

def exchange_code_for_token(*, code: str, redirect_uri: str, client_id: str, client_secret: str):
    data = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}
    r = requests.post(TOKEN_URL, data=data, headers=_basic_auth_header(client_id, client_secret), timeout=15)
    _raise_for_spotify_error(r)
    tok = r.json()
    tok["expires_at"] = int(time.time()) + int(tok.get("expires_in", 3600)) - 30
    return tok

def refresh_access_token(*, refresh_token: str, client_id: str, client_secret: str):
    data = {"grant_type": "refresh_token", "refresh_token": refresh_token}
    r = requests.post(TOKEN_URL, data=data, headers=_basic_auth_header(client_id, client_secret), timeout=15)
    _raise_for_spotify_error(r)
    tok = r.json()
    if "refresh_token" not in tok:
        tok["refresh_token"] = refresh_token
    tok["expires_at"] = int(time.time()) + int(tok.get("expires_in", 3600)) - 30
    return tok

def _auth_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

def _get(session, path: str, params: Optional[Dict[str, Any]]=None):
    tok = session.get("token") or {}
    access = tok.get("access_token")
    if not access:
        raise PermissionError("no_access_token")

    r = requests.get(f"{API_BASE}{path}", headers=_auth_headers(access), params=params or {}, timeout=15)
    if r.status_code == 401:
        rt = tok.get("refresh_token")
        if not rt:
            raise PermissionError("no_refresh_token")
        new_tok = refresh_access_token(
            refresh_token=rt,
            client_id=current_app.config["SPOTIFY_CLIENT_ID"],
            client_secret=current_app.config["SPOTIFY_CLIENT_SECRET"],
        )
        session["token"] = new_tok
        r = requests.get(f"{API_BASE}{path}", headers=_auth_headers(new_tok["access_token"]), params=params or {}, timeout=15)

    _raise_for_spotify_error(r)
    return r.json()

def get_me(session): return _get(session, "/me")
def get_my_top_tracks(session, *, limit=50, time_range="medium_term"):
    limit = max(1, min(int(limit), 50))
    return _get(session, "/me/top/tracks", params={"limit": limit, "time_range": time_range})
def get_my_top_artists(session, *, limit=50, time_range="medium_term"):
    limit = max(1, min(int(limit), 50))
    return _get(session, "/me/top/artists", params={"limit": limit, "time_range": time_range})
def get_recently_played(session, *, limit=50):
    limit = max(1, min(int(limit), 50))
    return _get(session, "/me/player/recently-played", params={"limit": limit})

def _request(session, method: str, path: str, *, params=None, json=None, expect_json=True):
    tok = session.get("token") or {}
    access = tok.get("access_token")
    if not access:
        return 401, {"error": "no_access_token"}

    url = f"{API_BASE}{path}"
    headers = _auth_headers(access)

    r = requests.request(method, url, headers=headers, params=params or {}, json=json, timeout=15)
    if r.status_code == 401:
        rt = tok.get("refresh_token")
        if not rt:
            return 401, {"error": "no_refresh_token"}
        new_tok = refresh_access_token(
            refresh_token=rt,
            client_id=current_app.config["SPOTIFY_CLIENT_ID"],
            client_secret=current_app.config["SPOTIFY_CLIENT_SECRET"],
        )
        session["token"] = new_tok
        headers = _auth_headers(new_tok["access_token"])
        r = requests.request(method, url, headers=headers, params=params or {}, json=json, timeout=15)

    # Success with no body
    if r.status_code == 204 and not expect_json:
        return 204, {"ok": True}

    # Normal OK
    if 200 <= r.status_code < 300:
        if expect_json:
            try:
                return r.status_code, r.json()
            except ValueError:
                return r.status_code, {"ok": True}
        else:
            return r.status_code, {"ok": True}

    # Error path: surface Spotify’s message instead of raising
    try:
        payload = r.json()
    except ValueError:
        payload = {"error": {"message": r.text[:200]}}
    return r.status_code, payload

def _put(session, path: str, *, params=None, json=None, expect_json=False):
    return _request(session, "PUT", path, params=params, json=json, expect_json=expect_json)

def _post(session, path: str, *, params=None, json=None, expect_json=False):
    return _request(session, "POST", path, params=params, json=json, expect_json=expect_json)

# ----- Player helpers -----

def get_devices(session):
    # GET /me/player/devices -> JSON
    return _request(session, "GET", "/me/player/devices", expect_json=True)

def transfer_playback(session, device_id: str, force_play: bool = False):
    # PUT /me/player 204
    body = {"device_ids": [device_id], "play": bool(force_play)}
    return _put(session, "/me/player", json=body, expect_json=False)

def play(session, *, uris=None, context_uri=None, position_ms=None, offset=None, device_id=None):
    # PUT /me/player/play 204
    payload = {}
    if uris: payload["uris"] = uris              # list of track URIs
    if context_uri: payload["context_uri"] = context_uri
    if offset is not None: payload["offset"] = offset  # {"position": n} or {"uri": "..."}
    if position_ms is not None: payload["position_ms"] = position_ms
    params = {"device_id": device_id} if device_id else None
    return _put(session, "/me/player/play", params=params, json=(payload or None), expect_json=False)

def pause(session, *, device_id=None):
    # PUT /me/player/pause 204
    params = {"device_id": device_id} if device_id else None
    return _put(session, "/me/player/pause", params=params, expect_json=False)

def next_track(session, *, device_id=None):
    # POST /me/player/next 204
    params = {"device_id": device_id} if device_id else None
    return _post(session, "/me/player/next", params=params, expect_json=False)

def previous_track(session, *, device_id=None):
    # POST /me/player/previous 204
    params = {"device_id": device_id} if device_id else None
    return _post(session, "/me/player/previous", params=params, expect_json=False)

def get_current_playback(session):
    # GET /me/player -> JSON (may be {} if nothing active)
    url = f"{API_BASE}/me/player"
    headers = _auth_headers(session["token"]["access_token"])
    r = requests.get(url, headers=headers)
    if r.status_code == 204:  # No active device / no playback
        return 204, {}

    _raise_for_spotify_error(r)
    return r.status_code, r.json()
