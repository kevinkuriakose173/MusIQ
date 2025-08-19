"use client";

import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import PlaylistModal from "./PlaylistModal";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

// ---- Types ----
type Img = { url: string; width?: number; height?: number };
type Artist = { id: string; name: string; images?: Img[]; uri: string; external_urls?: { spotify?: string } };
type Album = { id: string; name: string; images?: Img[]; uri: string; artists?: Artist[]; external_urls?: { spotify?: string } };
type Playlist = { id: string; name: string; images?: Img[]; owner?: { id?: string; display_name?: string }; uri: string; external_urls?: { spotify?: string } };
type Track = { id: string; name: string; uri: string; duration_ms: number; album?: Album; artists?: Artist[]; external_urls?: { spotify?: string } };

type SearchResponse = {
  tracks?: { items: Track[] };
  playlists?: { items: Playlist[] };
  albums?: { items: Album[] };
  artists?: { items: Artist[] };
};

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function SearchOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL state
  const urlQ = searchParams.get("q") ?? "";
  const hasQParam = searchParams.has("q");

  const [open, setOpen] = useState<boolean>(hasQParam);
  const [q, setQ] = useState<string>(urlQ);

  // Results
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keyboard/nav focus
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // PlaylistModal
  const [playlistOpenId, setPlaylistOpenId] = useState<string | null>(null);

  const debouncedQ = useDebounced(q, 350);
  const abortRef = useRef<AbortController | null>(null);

  // --- Global hotkey & keyboard nav ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (isModK) {
        e.preventDefault();
        toggleOpen();
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = flatItems;
        if (!items.length) return;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const ni = (focusIndex + dir + items.length) % items.length;
        setFocusIndex(ni);
        const el = listRef.current?.querySelector(`[data-idx="${ni}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[focusIndex];
        if (item) item.onEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focusIndex, q, res, pathname, router, searchParams]);

  // --- Sync open + q from URL ---
  useEffect(() => {
    setOpen(hasQParam);
    setQ(urlQ);
  }, [hasQParam, urlQ]);

  // --- Keep URL in sync while open ---
  useEffect(() => {
    if (!open) return;
    const sp = new URLSearchParams(searchParams.toString());
    // Keep 'q' param present while overlay is open, even if empty.
    sp.set("q", q);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [q, open, pathname, router, searchParams]);

  // --- Fetch search ---
  useEffect(() => {
    if (!open) return;
    if ((debouncedQ ?? "").trim().length < 2) {
      setRes(null);
      setErr(null);
      setLoading(false);
      setFocusIndex(0);
      return;
    }
    setLoading(true);
    setErr(null);
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        const types = "track,playlist,album,artist";
        const r = await fetch(
          `${B}/api/search?q=${encodeURIComponent(debouncedQ)}&types=${encodeURIComponent(types)}&limit=10`,
          { credentials: "include", signal: ctrl.signal }
        );
        if (!r.ok) throw new Error(await r.text());
        const raw = await r.json();
        // Normalize common proxy shapes: {data: ...} or {body: ...}
        const data: SearchResponse = (raw?.data ?? raw?.body ?? raw) as SearchResponse;

        setRes(data);
        setFocusIndex(0);
        // ensure first item is visible after DOM paints
        queueMicrotask(() => {
          const el = listRef.current?.querySelector('[data-idx="0"]') as HTMLElement | null;
          el?.scrollIntoView({ block: "nearest" });
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Search failed");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();

    return () => ctrl.abort();
  }, [debouncedQ, open]);

  const toggleOpen = () => {
    setOpen((o) => !o);
  };


  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!open) {
      sp.delete("q");
    } else {
      if (!sp.has("q")) sp.set("q", "");
    }
    router.replace(`${pathname}?${sp.toString()}`.replace(/\?$/, ""), { scroll: false });
  }, [open, pathname, router, searchParams]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setRes(null);
    setQ("");
    setFocusIndex(0);
    setPlaylistOpenId(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("q");
    router.replace(`${pathname}?${sp.toString()}`.replace(/\?$/, ""), { scroll: false });
  }, [pathname, router, searchParams]);

  const playTrack = async (trackUri: string) => {
    await fetch(`${B}/api/player/play`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [trackUri] }),
    });
  };

  const playContext = async (context_uri: string) => {
    await fetch(`${B}/api/player/play`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_uri }),
    });
  };

  type FlatItem = {
    key: string;
    label: string;
    subtitle?: string;
    image?: string;
    right?: string;
    onEnter: () => void;
    render: (idx: number, reactKey?: string) => JSX.Element;
  };

  const groups = useMemo(() => {
    const g: { title: string; items: FlatItem[] }[] = [];
    if (!res) return g;

    const pushGroup = (title: string, arr: FlatItem[]) => {
      if (arr.length) g.push({ title, items: arr });
    };

    // Top result (playlist > album > track > artist)
    const top: FlatItem[] = [];
    const firstPlaylist = res.playlists?.items?.[0];
    const firstAlbum = res.albums?.items?.[0];
    const firstTrack = res.tracks?.items?.[0];
    const firstArtist = res.artists?.items?.[0];

    if (firstPlaylist) {
      const img = firstPlaylist.images?.[0]?.url || "";
      top.push({
        key: `top-pl-${firstPlaylist.id}`,
        label: firstPlaylist.name,
        subtitle: "Playlist",
        image: img,
        onEnter: () => setPlaylistOpenId(firstPlaylist.id),
        render: (idx, reactKey) => row(idx, img, firstPlaylist.name, "Playlist", () => setPlaylistOpenId(firstPlaylist.id), reactKey),
      });
    } else if (firstAlbum) {
      const img = firstAlbum.images?.[0]?.url || "";
      top.push({
        key: `top-al-${firstAlbum.id}`,
        label: firstAlbum.name,
        subtitle: "Album",
        image: img,
        onEnter: () => playContext(firstAlbum.uri),
        render: (idx, reactKey) => row(idx, img, firstAlbum.name, "Album • ▶ Play", () => playContext(firstAlbum.uri), reactKey),
      });
    } else if (firstTrack) {
      const img = firstTrack.album?.images?.[0]?.url || "";
      const sub = [firstTrack.artists?.map((a) => a.name).join(", "), msToClock(firstTrack.duration_ms)].filter(Boolean).join(" • ");
      top.push({
        key: `top-tr-${firstTrack.id}`,
        label: firstTrack.name,
        subtitle: sub,
        image: img,
        onEnter: () => playTrack(firstTrack.uri),
        render: (idx, reactKey) => row(idx, img, firstTrack.name, `${sub} • ▶ Play`, () => playTrack(firstTrack.uri), reactKey),
      });
    } else if (firstArtist) {
      const img = firstArtist.images?.[0]?.url || "";
      top.push({
        key: `top-ar-${firstArtist.id}`,
        label: firstArtist.name,
        subtitle: "Artist",
        image: img,
        onEnter: () => window.open(firstArtist.external_urls?.spotify || "#", "_blank"),
        render: (idx, reactKey) =>
          row(
            idx,
            img,
            firstArtist.name,
            "Artist • Open on Spotify",
            () => window.open(firstArtist.external_urls?.spotify || "#", "_blank"),
            reactKey
          ),
      });
    }
    pushGroup("Top result", top);

    // Tracks
    const tracks: FlatItem[] = (res.tracks?.items ?? []).map((t) => {
      const img = t.album?.images?.[0]?.url || "";
      const sub = [t.artists?.map((a) => a.name).join(", "), msToClock(t.duration_ms)].filter(Boolean).join(" • ");
      return {
        key: `track-${t.id}`,
        label: t.name,
        subtitle: sub,
        image: img,
        onEnter: () => playTrack(t.uri),
        render: (idx, reactKey) => row(idx, img, t.name, `${sub} • ▶ Play`, () => playTrack(t.uri), reactKey),
      };
    });
    pushGroup("Tracks", tracks);

    // Playlists
    const playlists: FlatItem[] = (res.playlists?.items ?? [])
      // 1) drop null/undefined items AND items without an id
      .filter((p): p is Playlist => !!p && !!p.id)
      .map((p) => {
        // 2) now p is guaranteed and has an id
        const img = p.images?.[0]?.url ?? "";
        const owner = p.owner?.display_name ?? "—";
        const key = `playlist-${p.id}`;

        return {
          key,
          label: p.name ?? "(untitled playlist)",
          subtitle: `Playlist • ${owner}`,
          image: img,
          onEnter: () => setPlaylistOpenId(p.id), // safe: p.id exists
          render: (idx, reactKey) =>
            row(
              idx,
              img,
              p.name ?? "(untitled playlist)",
              `Playlist • ${owner} • Open`,
              () => setPlaylistOpenId(p.id),
              reactKey ?? key // ensure a stable, non-undefined key
            ),
        };
      });

    pushGroup("Playlists", playlists);

    // Albums
    const albums: FlatItem[] = (res.albums?.items ?? []).map((a) => {
      const img = a.images?.[0]?.url || "";
      const sub = `Album • ${(a.artists ?? []).map((ar) => ar.name).join(", ")}`;
      return {
        key: `album-${a.id}`,
        label: a.name,
        subtitle: sub,
        image: img,
        onEnter: () => playContext(a.uri),
        render: (idx, reactKey) => row(idx, img, a.name, `${sub} • ▶ Play`, () => playContext(a.uri), reactKey),
      };
    });
    pushGroup("Albums", albums);

    // Artists
    const artists: FlatItem[] = (res.artists?.items ?? []).map((a) => {
      const img = a.images?.[0]?.url || "";
      return {
        key: `artist-${a.id}`,
        label: a.name,
        subtitle: "Artist",
        image: img,
        onEnter: () => window.open(a.external_urls?.spotify || "#", "_blank"),
        render: (idx, reactKey) =>
          row(idx, img, a.name, "Artist • Open on Spotify", () => window.open(a.external_urls?.spotify || "#", "_blank"), reactKey),
      };
    });
    pushGroup("Artists", artists);

    return g;
  }, [res]);

  const flatItems: { onEnter: () => void }[] = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  function row(
    idx: number,
    img: string,
    title: string,
    subtitle: string,
    onClick: () => void,
    reactKey?: string
  ) {
    const isFocused = idx === focusIndex;
    return (
      <div
        key={reactKey ?? idx}
        data-idx={idx}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${isFocused ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
        role="button"
        tabIndex={-1}
        aria-pressed={isFocused}
      >
        {img ? (
          <img src={img} alt="" className="w-10 h-10 rounded object-cover" />
        ) : (
          <div className="w-10 h-10 rounded bg-neutral-700" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          <div className="truncate text-xs text-neutral-400">{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 🔍 Button to open search */}
      <button
        onClick={toggleOpen}
        className="p-2 rounded hover:bg-neutral-800 flex items-center gap-2"
        title="Search (⌘K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />

          {/* Overlay */}
          <div
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 rounded-xl overflow-hidden shadow-lg bg-neutral-900 border border-neutral-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-label"
          >
            {/* Search bar */}
            <div className="p-3 border-b border-neutral-700">
              <input
                id="search-label"
                autoFocus
                className="w-full px-3 py-2 rounded bg-neutral-800 outline-none text-white"
                placeholder="Search Spotify..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto divide-y divide-neutral-800">
              {loading && <div className="p-4 text-center text-neutral-400">Loading…</div>}
              {err && <div className="p-4 text-center text-red-400">{err}</div>}
              {!loading && !err && groups.length === 0 && debouncedQ.length >= 2 && (
                <div className="p-4 text-center text-neutral-400">No results</div>
              )}
              {groups.map((g, gi) => {
                const base = groups.slice(0, gi).reduce((sum, gg) => sum + gg.items.length, 0);
                return (
                  <div key={g.title}>
                    <div className="px-3 py-2 text-xs uppercase text-neutral-500">{g.title}</div>
                    {g.items.map((item, ii) => item.render(base + ii, item.key))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Playlist modal */}
          {playlistOpenId && (
            <PlaylistModal
              open={!!playlistOpenId}
              onClose={() => setPlaylistOpenId(null)}
              playlistId={playlistOpenId}
            />
          )}
        </>
      )}
    </>
  );
}
