from flask import Blueprint, request, jsonify, session
from ..services.spotify import (
    get_me, get_my_top_tracks, get_my_top_artists, get_recently_played,
    get_devices, transfer_playback, play, pause, next_track, previous_track,
    get_current_playback,
)
from ..utils.tokens import require_access_token

bp = Blueprint("api", __name__)

@bp.get("/me")
@require_access_token
def me():
    return jsonify(get_me(session))

@bp.get("/me/top-tracks")
@require_access_token
def top_tracks():
    limit = int(request.args.get("limit", 50))
    time_range = request.args.get("time_range", "medium_term")
    return jsonify(get_my_top_tracks(session, limit=limit, time_range=time_range))

@bp.get("/me/top-artists")
@require_access_token
def top_artists():
    limit = int(request.args.get("limit", 50))
    time_range = request.args.get("time_range", "medium_term")
    return jsonify(get_my_top_artists(session, limit=limit, time_range=time_range))

@bp.get("/me/recently-played")
@require_access_token
def recently_played():
    limit = int(request.args.get("limit", 50))
    return jsonify(get_recently_played(session, limit=limit))

# ---- Player endpoints ----

@bp.get("/player/devices")
@require_access_token
def player_devices():
    status, data = get_devices(session)
    return jsonify(data), status

@bp.put("/player/transfer")
@require_access_token
def player_transfer():
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id required"}), 400
    force_play = request.args.get("play", "false").lower() == "true"
    status, data = transfer_playback(session, device_id, force_play=force_play)
    return (jsonify(data), status)

@bp.put("/player/play")
@require_access_token
def player_play():
    payload = request.get_json(silent=True) or {}
    status, data = play(session, **payload)  # accepts uris, context_uri, position_ms, offset
    return (jsonify(data), status)

@bp.put("/player/pause")
@require_access_token
def player_pause():
    status, data = pause(session)
    return (jsonify(data), status)

@bp.post("/player/next")
@require_access_token
def player_next():
    status, data = next_track(session)
    return (jsonify(data), status)

@bp.post("/player/previous")
@require_access_token
def player_previous():
    status, data = previous_track(session)
    return (jsonify(data), status)

@bp.get("/player/current")
@require_access_token
def player_current():
    status, payload = get_current_playback(session)
    if status == 204:
        return ("", 204)
    return jsonify(payload), status
