from flask import Blueprint, request, jsonify, session
from ..services.spotify import (
    get_me, get_my_top_tracks, get_my_top_artists, get_recently_played,
    get_devices, transfer_playback, play, pause, next_track, previous_track,
    get_current_playback, search,
    get_my_playlists, get_playlist, get_playlist_tracks,
    create_playlist, add_tracks_to_playlist, remove_tracks_from_playlist,
    get_saved_tracks, save_tracks, remove_saved_tracks,
    get_saved_albums, save_albums, remove_saved_albums,
    add_to_queue, seek, set_shuffle, set_repeat, set_volume,
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
    status, data = get_my_top_tracks(session, limit=limit, time_range=time_range)
    return (jsonify((data.get("items", []))), status)

@bp.get("/me/top-artists")
@require_access_token
def top_artists():
    limit = int(request.args.get("limit", 50))
    time_range = request.args.get("time_range", "medium_term")
    status, data = get_my_top_artists(session, limit=limit, time_range=time_range)
    return (jsonify(data.get("items", [])), status)

@bp.get("/me/recently-played")
@require_access_token
def recently_played():
    limit = int(request.args.get("limit", 50))
    status, data = get_recently_played(session, limit=limit)
    return (jsonify(data), status)

# ---- Player endpoints ----

@bp.get("/player/devices")
@require_access_token
def player_devices():
    status, data = get_devices(session)
    return (jsonify(data), status)

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

@bp.get("/search")
@require_access_token
def search_route():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "q required"}), 400
    types = request.args.get("types", "track,album,artist,playlist")
    limit = min(max(int(request.args.get("limit", 20)), 1), 50)
    offset = max(int(request.args.get("offset", 0)), 0)
    status, data = search(session, q=q, types=types, limit=limit, offset=offset)
    return (jsonify(data), status)

@bp.get("/me/playlists")
@require_access_token
def my_playlists_route():
    limit = min(max(int(request.args.get("limit", 20)), 1), 50)
    offset = max(int(request.args.get("offset", 0)), 0)

    result = get_my_playlists(session, limit=limit, offset=offset)

    if isinstance(result, tuple) and len(result) == 2:
        status, data = result
    else:
        status, data = 200, result

    return (jsonify(data), status)

@bp.get("/playlists/<playlist_id>")
@require_access_token
def playlist_meta_route(playlist_id):
    status, data = get_playlist(session, playlist_id)
    return (jsonify(data), status)

@bp.get("/playlists/<playlist_id>/tracks")
@require_access_token
def playlist_tracks_route(playlist_id):
    limit = min(max(int(request.args.get("limit", 50)), 1), 100)
    offset = max(int(request.args.get("offset", 0)), 0)
    status, data = get_playlist_tracks(session, playlist_id, limit=limit, offset=offset)
    return (jsonify(data), status)

@bp.post("/playlists")
@require_access_token
def create_playlist_route():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    description = body.get("description") or ""
    public = bool(body.get("public", False))
    status, data = create_playlist(session, name=name, description=description, public=public)
    return (jsonify(data), status)

@bp.post("/playlists/<playlist_id>/tracks")
@require_access_token
def add_playlist_tracks_route(playlist_id):
    body = request.get_json(silent=True) or {}
    uris = body.get("uris") or []
    position = body.get("position")  # optional
    if not isinstance(uris, list) or not uris:
        return jsonify({"error": "uris[] required"}), 400
    status, data = add_tracks_to_playlist(session, playlist_id, uris=uris, position=position)
    return (jsonify(data), status)

@bp.delete("/playlists/<playlist_id>/tracks")
@require_access_token
def remove_playlist_tracks_route(playlist_id):
    body = request.get_json(silent=True) or {}
    uris = body.get("uris") or []
    if not isinstance(uris, list) or not uris:
        return jsonify({"error": "uris[] required"}), 400
    status, data = remove_tracks_from_playlist(session, playlist_id, uris=uris)
    return (jsonify(data), status)

@bp.get("/me/library/tracks")
@require_access_token
def library_tracks_get():
    limit = min(max(int(request.args.get("limit", 20)), 1), 50)
    offset = max(int(request.args.get("offset", 0)), 0)
    status, data = get_saved_tracks(session, limit=limit, offset=offset)
    return (jsonify(data), status)

@bp.put("/me/library/tracks")
@require_access_token
def library_tracks_save():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids[] required"}), 400
    status, data = save_tracks(session, ids=ids)
    return (jsonify(data), status)

@bp.delete("/me/library/tracks")
@require_access_token
def library_tracks_remove():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids[] required"}), 400
    status, data = remove_saved_tracks(session, ids=ids)
    return (jsonify(data), status)

@bp.get("/me/library/albums")
@require_access_token
def library_albums_get():
    limit = min(max(int(request.args.get("limit", 20)), 1), 50)
    offset = max(int(request.args.get("offset", 0)), 0)
    status, data = get_saved_albums(session, limit=limit, offset=offset)
    return (jsonify(data), status)

@bp.put("/me/library/albums")
@require_access_token
def library_albums_save():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids[] required"}), 400
    status, data = save_albums(session, ids=ids)
    return (jsonify(data), status)

@bp.delete("/me/library/albums")
@require_access_token
def library_albums_remove():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids[] required"}), 400
    status, data = remove_saved_albums(session, ids=ids)
    return (jsonify(data), status)

@bp.post("/player/queue")
@require_access_token
def player_queue_add():
    uri = request.args.get("uri")
    if not uri:
        return jsonify({"error": "uri required"}), 400
    device_id = request.args.get("device_id")
    status, data = add_to_queue(session, uri, device_id=device_id)
    return (jsonify(data), status)

@bp.put("/player/seek")
@require_access_token
def player_seek():
    try:
        position_ms = int(request.args.get("position_ms", ""))
    except ValueError:
        return jsonify({"error": "position_ms must be int"}), 400
    status, data = seek(session, position_ms=position_ms)
    return (jsonify(data), status)

@bp.put("/player/shuffle")
@require_access_token
def player_shuffle():
    state = request.args.get("state", "").lower()
    if state not in {"true", "false"}:
        return jsonify({"error": "state must be true|false"}), 400
    device_id = request.args.get("device_id")
    status, data = set_shuffle(session, state == "true", device_id=device_id)
    return (jsonify(data), status)

@bp.put("/player/repeat")
@require_access_token
def player_repeat():
    state = request.args.get("state", "").lower()
    if state not in {"off", "track", "context"}:
        return jsonify({"error": "state must be off|track|context"}), 400
    device_id = request.args.get("device_id")
    status, data = set_repeat(session, state, device_id=device_id)
    return (jsonify(data), status)

@bp.put("/player/volume")
@require_access_token
def player_volume():
    try:
        percent = int(request.args.get("percent", ""))
    except ValueError:
        return jsonify({"error": "percent must be int"}), 400
    if not (0 <= percent <= 100):
        return jsonify({"error": "percent must be 0..100"}), 400
    device_id = request.args.get("device_id")
    status, data = set_volume(session, percent, device_id=device_id)
    return (jsonify(data), status)