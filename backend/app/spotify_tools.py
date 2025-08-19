from flask import Blueprint, request, jsonify, session
from .services.spotify import (
    search,
    add_tracks_to_playlist,
    play,
)
from .utils.tokens import require_access_token

bp = Blueprint("spotify_tools", __name__, url_prefix="/spotify-tools")

@bp.post("/resolve")
@require_access_token
def resolve():
    """
    Body:
    {
      "candidates": [ {"artist":"...", "track":"...?"}, ... ],
      "limit": 10
    }
    Uses existing `search(session, ...)` from services/spotify.py.
    """
    body = request.get_json(force=True) or {}
    candidates = body.get("candidates") or []
    resolved = []

    for c in candidates:
        artist = (c.get("artist") or "").strip()
        track  = (c.get("track") or "").strip()

        if artist and track:
            q = f'track:"{track}" artist:"{artist}"'
            types = "track"
        elif track:
            q = f'track:"{track}"'
            types = "track"
        elif artist:
            q = f'artist:"{artist}"'
            types = "artist"
        else:
            continue

        status, data = search(session, q=q, types=types, limit=1, offset=0)
        if status != 200:
            resolved.append({"query": {"artist": artist, "track": track}, "error": f"spotify_search_failed:{status}"})
            continue

        out = {"query": {"artist": artist, "track": track}}
        if types == "track" and data.get("tracks", {}).get("items"):
            t = data["tracks"]["items"][0]
            out["type"] = "track"
            out["track"] = {
                "id": t["id"],
                "uri": t["uri"],
                "name": t["name"],
                "artist_names": [a["name"] for a in t["artists"]],
                "image": (t["album"]["images"][0]["url"] if t["album"]["images"] else None),
            }
        if types == "artist" and data.get("artists", {}).get("items"):
            a = data["artists"]["items"][0]
            out["type"] = "artist"
            out["artist"] = {
                "id": a["id"],
                "uri": a["uri"],
                "name": a["name"],
                "image": (a["images"][0]["url"] if a.get("images") else None),
            }
        resolved.append(out)

    return jsonify({"resolved": resolved})


@bp.post("/add-to-playlist")
@require_access_token
def add_to_playlist_route():
    body = request.get_json(force=True) or {}
    playlist_id = body.get("playlist_id")
    track_uris = body.get("track_uris") or []

    if not playlist_id or not track_uris:
        return jsonify({"error": "playlist_id and track_uris are required"}), 400

    status, data = add_tracks_to_playlist(session, playlist_id, track_uris)
    return jsonify(data), status


@bp.post("/play")
@require_access_token
def play_route():
    """
    Body:
    {
      "device_id": "...",
      "uris": ["spotify:track:..."]  OR
      "context_uri": "spotify:playlist:..."
    }
    """
    body = request.get_json(force=True) or {}
    status, data = play(session, **body)
    return jsonify(data), status
