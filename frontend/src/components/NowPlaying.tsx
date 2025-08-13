"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type Artist = { name: string };
type AlbumImage = { url: string; width: number; height: number };
type Track = {
  id: string;
  name: string;
  artists: Artist[];
  album: { images: AlbumImage[] };
  uri: string;
  external_urls?: { spotify?: string };
  duration_ms: number;
};

type Playback = {
  is_playing: boolean;
  progress_ms: number;
  item: Track | null;
  device?: { name: string; is_active: boolean };
  actions?: { disallows?: Record<string, boolean> };
};

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function NowPlaying() {
  const [pb, setPb] = useState<Playback | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${B}/api/player/current`, { credentials: "include" });
      if (!r.ok) {
        setPb(null);
        return;
      }
      const data = await r.json();
      // Spotify returns {} when nothing is playing
      setPb(Object.keys(data || {}).length ? data : null);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 4s; locally increment progress while playing for smooth UI
  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (pb?.is_playing && pb?.item) {
      timer.current = setInterval(() => {
        setPb((prev) =>
          prev && prev.item
            ? {
                ...prev,
                progress_ms: Math.min(prev.item.duration_ms, (prev.progress_ms || 0) + 1000),
              }
            : prev
        );
      }, 1000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [pb?.is_playing, pb?.item?.id]);

  const artUrl = useMemo(() => {
    const imgs = pb?.item?.album?.images || [];
    return imgs.sort((a, b) => b.width - a.width)[imgs.length - 1]?.url || imgs[0]?.url || "";
  }, [pb?.item?.album?.images]);

  if (loading && !pb) {
    return <div className="text-sm opacity-70">Loading current playback…</div>;
  }

  if (!pb || !pb.item) {
    return <div className="text-sm opacity-70">Nothing playing.</div>;
  }

  const { item, progress_ms = 0, is_playing } = pb;
  const pct = Math.min(100, Math.round((progress_ms / item.duration_ms) * 100));

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border bg-black/30">
      {artUrl ? (
        <img src={artUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-md bg-neutral-800" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {item.external_urls?.spotify ? (
            <a href={item.external_urls.spotify} target="_blank" rel="noreferrer" className="hover:underline">
              {item.name}
            </a>
          ) : (
            item.name
          )}
        </div>
        <div className="text-sm text-neutral-400 truncate">
          {item.artists.map((a) => a.name).join(", ")}
        </div>
        <div className="mt-2">
          <div className="h-1.5 bg-neutral-700 rounded">
            <div className="h-1.5 rounded bg-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            <span>{msToClock(progress_ms)}</span>
            <span>{msToClock(item.duration_ms)}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-neutral-400 w-28 text-right">
        {is_playing ? "Playing" : "Paused"}
        <div className="truncate">{pb.device?.name}</div>
      </div>
    </div>
  );
}
