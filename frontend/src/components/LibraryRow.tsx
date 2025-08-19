"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PlaylistModal from "./PlaylistModal"; 


const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type PlaylistImage = { url: string; width?: number; height?: number };
type Owner = { display_name?: string };
type Playlist = {
  id: string;
  name: string;
  description?: string;
  images?: PlaylistImage[];
  tracks?: { total?: number };
  owner?: Owner;
  uri: string; // spotify:playlist:...
  external_urls?: { spotify?: string };
};

type Page<T> = {
  items: T[];
  total?: number;
  limit: number;
  offset: number;
  next?: string | null;
};

const LIMIT = 20;

export default function LibraryRow() {
  const [items, setItems] = useState<Playlist[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  const hasMore = total === null || items.length < (total ?? 0);

  const fetchPage = async (off: number) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${B}/api/me/playlists?limit=${LIMIT}&offset=${off}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      const data: Page<Playlist> | any = await r.json();
      // Spotify’s /me/playlists returns { items, total, limit, offset, next, previous }
      setItems((prev) => (off === 0 ? data.items : [...prev, ...data.items]));
      setTotal(data.total ?? null);
      setOffset(off + (data.items?.length ?? 0));
    } catch (e: any) {
      setError(e?.message || "Failed to load playlists");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // initial load
  useEffect(() => {
    void fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // prefetch when near the right edge
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!hasMore || loading) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const distanceFromRight = scrollWidth - (scrollLeft + clientWidth);
      if (distanceFromRight < clientWidth * 1.5) {
        // close to the end → fetch next page
        void fetchPage(offset);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [offset, hasMore, loading]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.9);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const playContext = async (context_uri: string) => {
    try {
      await fetch(`${B}/api/player/play`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_uri }),
      });
    } catch (e) {
      // optionally surface an error toast
      console.error(e);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Your Playlists</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scrollBy("left")}
            className="px-2 py-1 text-sm rounded border hover:bg-white/10"
            aria-label="Scroll left"
          >
            ◀
          </button>
          <button
            onClick={() => scrollBy("right")}
            className="px-2 py-1 text-sm rounded border hover:bg白/10 hover:bg-white/10"
            aria-label="Scroll right"
          >
            ▶
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="relative flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2"
      >
        {items.map((p) => (
          <PlaylistCard key={p.id} p={p} onPlay={() => playContext(p.uri)} />
        ))}

        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 mt-2">
          {error}
        </div>
      )}
    </section>
  );
}

function PlaylistCard({ p, onPlay }: { p: Playlist; onPlay: () => void }) {
  const img = useMemo(() => {
    const imgs = p.images || [];
    return imgs[imgs.length - 1]?.url || imgs[0]?.url || "";
  }, [p.images]);

  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="snap-start shrink-0 w-48 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-neutral-900">
          {img ? (
            <img
              src={img}
              alt={p.name}
              className="w-48 h-48 object-cover"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="w-48 h-48 bg-neutral-800" />
          )}

          {/* Play overlay */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // prevent modal from opening
              onPlay();
            }}
            aria-label={`Play ${p.name}`}
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-3 py-2 rounded-full bg-white text-black text-sm shadow"
          >
            ▶
          </button>
        </div>

        <div className="mt-2">
          <div className="font-medium truncate" title={p.name}>
            {p.name}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            {p.owner?.display_name || "—"} • {p.tracks?.total ?? 0} tracks
          </div>
        </div>
      </div>

      {/* Modal */}
      <PlaylistModal
        open={open}
        playlistId={p.id}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="snap-start shrink-0 w-48 animate-pulse">
      <div className="w-48 h-48 rounded-xl bg-neutral-800" />
      <div className="h-4 bg-neutral-800 rounded mt-2" />
      <div className="h-3 bg-neutral-800 rounded mt-1 w-32" />
    </div>
  );
}
