"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type Img = { url: string; width?: number; height?: number };
type Owner = { id?: string; display_name?: string };
type TrackArtist = { name: string };
type Album = { name: string; images?: Img[] };
type Track = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists?: TrackArtist[];
  album?: Album;
  external_urls?: { spotify?: string };
};
type PlaylistTrackItem = {
  added_at: string;
  track: Track | null; // Spotify can have null (removed/unavailable)
};
type Playlist = {
  id: string;
  name: string;
  description?: string;
  images?: Img[];
  tracks?: { total?: number };
  owner?: Owner;
  uri: string;
};

type Page<T> = {
  items: T[];
  limit: number;
  offset: number;
  total?: number;
  next?: string | null;
};

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function PlaylistModal({
  open,
  onClose,
  playlistId,
}: {
  open: boolean;
  onClose: () => void;
  playlistId: string | null;
}) {
  const [meta, setMeta] = useState<Playlist | null>(null);
  const [rows, setRows] = useState<PlaylistTrackItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState(false);

  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  const LIMIT = 100; // Spotify max for playlist tracks page size

  // Reset on open/playlist change
  useEffect(() => {
    if (!open || !playlistId) return;
    setMeta(null);
    setRows([]);
    setTotal(null);
    setOffset(0);
    setFilter("");
    setSelected({});
    setTargetPlaylistId("");
    setError(null);
  }, [open, playlistId]);

  // Load me, meta, and first page
  useEffect(() => {
    if (!open || !playlistId) return;

    const loadMe = async () => {
      try {
        const r = await fetch(`${B}/api/me`, { credentials: "include" });
        if (r.ok) {
          const me = await r.json();
          setMeId(me?.id ?? null);
        }
      } catch {
        // ignore
      }
    };

    const loadMeta = async () => {
      setLoadingMeta(true);
      try {
        const r = await fetch(`${B}/api/playlists/${playlistId}`, { credentials: "include" });
        if (!r.ok) throw new Error(await r.text());
        const data: Playlist = await r.json();
        setMeta(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load playlist");
      } finally {
        setLoadingMeta(false);
      }
    };

    const loadFirstPage = async () => {
      setLoadingPage(true);
      try {
        const r = await fetch(`${B}/api/playlists/${playlistId}/tracks?limit=${LIMIT}&offset=0`, {
          credentials: "include",
        });
        if (!r.ok) throw new Error(await r.text());
        const data: Page<PlaylistTrackItem> = await r.json();
        setRows(data.items || []);
        setTotal(data.total ?? null);
        setOffset(data.items?.length || 0);
      } catch (e: any) {
        setError(e?.message || "Failed to load tracks");
      } finally {
        setLoadingPage(false);
      }
    };

    void loadMe();
    void loadMeta();
    void loadFirstPage();
  }, [open, playlistId]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open || total === null) return;

    const onScroll = () => {
      if (fetchingRef.current || loadingPage) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - (scrollTop + clientHeight) < 400) {
        if (rows.length < (total ?? 0)) {
          fetchingRef.current = true;
          (async () => {
            try {
              setLoadingPage(true);
              const r = await fetch(
                `${B}/api/playlists/${playlistId}/tracks?limit=${LIMIT}&offset=${offset}`,
                { credentials: "include" }
              );
              if (!r.ok) throw new Error(await r.text());
              const data: Page<PlaylistTrackItem> = await r.json();
              setRows((prev) => [...prev, ...(data.items || [])]);
              setOffset(offset + (data.items?.length || 0));
            } catch {
              // soft-fail
            } finally {
              setLoadingPage(false);
              fetchingRef.current = false;
            }
          })();
        }
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, rows.length, offset, total, loadingPage, playlistId]);

  // Load user's playlists for "Add to another playlist"
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch(`${B}/api/me/playlists?limit=50&offset=0`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        setMyPlaylists(data.items || []);
      } catch {
        // ignore
      }
    })();
  }, [open]);

  const img = useMemo(() => meta?.images?.[0]?.url || "", [meta?.images]);

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.filter((it) => {
      const t = it.track;
      if (!t) return false;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.artists || []).some((a) => a.name.toLowerCase().includes(q)) ||
        (t.album?.name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter]);

  const toggleSelect = (trackId: string) => {
    setSelected((s) => ({ ...s, [trackId]: !s[trackId] }));
  };

  const clearSelection = () => setSelected({});

  const selectedUris = useMemo(
    () =>
      filteredRows
        .map((it) => it.track)
        .filter((t): t is Track => Boolean(t && selected[t.id]))
        .map((t) => t.uri),
    [filteredRows, selected]
  );

  const playTrack = async (trackUri: string) => {
    if (!meta?.uri) return;
    try {
      await fetch(`${B}/api/player/play`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_uri: meta.uri,
          offset: { uri: trackUri },
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const removeTracks = async (uris: string[]) => {
    if (!playlistId || uris.length === 0) return;
    setActing(true);
    try {
      // Optimistic UI
      const toRemove = new Set(uris);
      setRows((prev) => prev.filter((it) => !(it.track && toRemove.has(it.track.uri))));

      // API (chunked)
      for (let i = 0; i < uris.length; i += 100) {
        const chunk = uris.slice(i, i + 100);
        const r = await fetch(`${B}/api/playlists/${playlistId}/tracks`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris: chunk }),
        });
        if (!r.ok) {
          await reloadPageHard();
          throw new Error(await r.text());
        }
      }
      clearSelection();
    } catch (e) {
      console.error(e);
    } finally {
      setActing(false);
    }
  };

  const addToAnotherPlaylist = async (destPlaylistId: string, uris: string[]) => {
    if (!destPlaylistId || uris.length === 0) return;
    setActing(true);
    try {
      for (let i = 0; i < uris.length; i += 100) {
        const chunk = uris.slice(i, i + 100);
        const r = await fetch(`${B}/api/playlists/${destPlaylistId}/tracks`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris: chunk }),
        });
        if (!r.ok) throw new Error(await r.text());
      }
      clearSelection();
    } catch (e) {
      console.error(e);
    } finally {
      setActing(false);
    }
  };

  const reloadPageHard = async () => {
    if (!playlistId) return;
    try {
      const r = await fetch(`${B}/api/playlists/${playlistId}/tracks?limit=${LIMIT}&offset=0`, {
        credentials: "include",
      });
      if (r.ok) {
        const data: Page<PlaylistTrackItem> = await r.json();
        setRows(data.items || []);
        setTotal(data.total ?? null);
        setOffset(data.items?.length || 0);
      }
    } catch {
      // ignore
    }
  };

  if (!open || !playlistId) return null;

  const canEdit = !!(meta?.owner?.id && meId && meta.owner.id === meId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* modal */}
      <div className="relative w-[900px] max-w-[95vw] max-h-[85vh] rounded-2xl border bg-neutral-900 text-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-white/10">
          {img ? (
            <img src={img} className="w-20 h-20 rounded-md object-cover" alt={meta?.name || "Playlist"} />
          ) : (
            <div className="w-20 h-20 rounded-md bg-neutral-800" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase text-neutral-400">Playlist</div>
            <div className="text-xl font-semibold truncate flex items-center gap-2">
              <span className="truncate">{meta?.name || "—"}</span>
              {!canEdit && (
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-white/10 shrink-0">
                  Read‑only
                </span>
              )}
            </div>
            <div className="text-sm text-neutral-400 truncate">
              {meta?.owner?.display_name || "—"} • {meta?.tracks?.total ?? total ?? 0} tracks
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-2 rounded border hover:bg-white/10">✕</button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-white/10">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search in playlist..."
            className="flex-1 px-3 py-2 rounded bg-neutral-800 outline-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={targetPlaylistId}
              onChange={(e) => setTargetPlaylistId(e.target.value)}
              className="px-2 py-2 rounded bg-neutral-800"
              title="Choose destination playlist"
            >
              <option value="">Add to… (choose playlist)</option>
              {myPlaylists
                .filter((p) => p.id !== playlistId && (!meId || p.owner?.id === meId))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <button
              disabled={acting || !targetPlaylistId || selectedUris.length === 0}
              onClick={() => addToAnotherPlaylist(targetPlaylistId, selectedUris)}
              className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
            >
              Add Selected
            </button>
            <button
              disabled={acting || selectedUris.length === 0 || !canEdit}
              onClick={() => (canEdit ? removeTracks(selectedUris) : undefined)}
              className="px-3 py-2 rounded border hover:bg-white/10 disabled:opacity-50"
              title={canEdit ? "Delete selected" : "You can only edit playlists you own"}
            >
              Delete Selected
            </button>
          </div>
        </div>

        {/* Track list */}
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: "55vh" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur border-b border-white/10">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-300">
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all filtered"
                    checked={
                      filteredRows.length > 0 &&
                      filteredRows.every((it) => it.track && selected[it.track.id])
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const next: Record<string, boolean> = { ...selected };
                      for (const it of filteredRows) {
                        if (!it.track) continue;
                        next[it.track.id] = checked;
                      }
                      setSelected(next);
                    }}
                  />
                </th>
                <th>Title</th>
                <th>Artist</th>
                <th>Album</th>
                <th style={{ width: 80 }} className="text-right">Time</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((it) => {
                const t = it.track;
                if (!t) return null;
                const imgs = t.album?.images || [];
                const albumImg = imgs[imgs.length - 1]?.url || imgs[0]?.url || "";
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[t.id]}
                        onChange={() => toggleSelect(t.id)}
                        aria-label={`Select ${t.name}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {albumImg ? (
                          <img src={albumImg} className="w-10 h-10 rounded object-cover" alt="" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-neutral-800" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          <div className="text-xs text-neutral-400 truncate">{it.added_at.slice(0, 10)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 truncate">
                      {(t.artists || []).map((a) => a.name).join(", ")}
                    </td>
                    <td className="px-3 py-2 truncate">{t.album?.name || "—"}</td>
                    <td className="px-3 py-2 text-right">{msToClock(t.duration_ms)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => playTrack(t.uri)}
                          className="px-2 py-1 rounded border hover:bg-white/10"
                          title="Play"
                        >
                          ▶
                        </button>
                        <button
                          onClick={() => (canEdit ? removeTracks([t.uri]) : undefined)}
                          disabled={!canEdit}
                          className="px-2 py-1 rounded border hover:bg-white/10 disabled:opacity-50"
                          title={canEdit ? "Delete from this playlist" : "Not your playlist"}
                        >
                          🗑
                        </button>
                        <button
                          onClick={() =>
                            targetPlaylistId
                              ? addToAnotherPlaylist(targetPlaylistId, [t.uri])
                              : undefined
                          }
                          disabled={!targetPlaylistId}
                          className="px-2 py-1 rounded border hover:bg-white/10 disabled:opacity-50"
                          title={targetPlaylistId ? "Add to selected playlist" : "Choose destination above"}
                        >
                          ➕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {loadingPage && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 text-xs text-neutral-400">
          <div>
            {filteredRows.length} shown
            {total !== null ? ` • ${total} total` : ""}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-3 py-2 rounded border hover:bg-white/10">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
