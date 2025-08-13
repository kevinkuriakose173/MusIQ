"use client";

import { useEffect, useRef, useState } from "react";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

// Fire-and-forget calls that throw on non-2xx
async function call(method: "PUT" | "POST", path: string) {
  const res = await fetch(`${B}${path}`, { method, credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
}

// Fetch current playback state: expects { is_playing: boolean, ... }
async function fetchPlaybackState(): Promise<boolean> {
  const res = await fetch(`${B}/api/player/current`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Boolean(data?.is_playing);
}

export default function PlaybackControls() {
  const [loading, setLoading] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean | null>(null); // null = unknown (initial load)
  const pollId = useRef<number | null>(null);

  // unified loading wrapper
  const wrap = (fn: () => Promise<void>, key: string) => async () => {
    try {
      setLoading(key);
      await fn();
    } finally {
      setLoading(null);
    }
  };

  // Initial load + light polling to stay in sync with external controls
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const playing = await fetchPlaybackState();
        if (!cancelled) setIsPlaying(playing);
      } catch {
        if (!cancelled) setIsPlaying(null); // unknown
      }
    };

    load();
    pollId.current = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      if (pollId.current) window.clearInterval(pollId.current);
    };
  }, []);

  // Toggle handler chooses play or pause based on current state
  const togglePlayPause = async () => {
    // Optimistic update for snappy UI
    const next = !(isPlaying ?? false);
    setIsPlaying(next);

    try {
      if (next) {
        await call("PUT", "/api/player/play");
      } else {
        await call("PUT", "/api/player/pause");
      }
    } catch (err) {
      // Revert on failure
      setIsPlaying(!next);
      // Optional: surface the backend error
      console.error(err);
      alert(typeof err === "string" ? err : (err as Error).message);
    } finally {
      // Re-sync with the source of truth
      try {
        setIsPlaying(await fetchPlaybackState());
      } catch {
        /* ignore */
      }
    }
  };

  const disableAll = loading !== null;

  return (
    <div className="flex items-center gap-3">
      <button
        className="px-3 py-2 rounded border"
        disabled={disableAll}
        onClick={wrap(() => call("POST", "/api/player/previous"), "prev")}
        aria-label="Previous track"
      >
        ⏮ Prev
      </button>

      {/* Single Play/Pause toggle */}
      <button
        className="px-3 py-2 rounded border"
        disabled={disableAll || isPlaying === null} // disable while unknown
        onClick={wrap(togglePlayPause, "toggle")}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸ Pause" : "▶️ Play"}
      </button>

      <button
        className="px-3 py-2 rounded border"
        disabled={disableAll}
        onClick={wrap(() => call("POST", "/api/player/next"), "next")}
        aria-label="Next track"
      >
        ⏭ Next
      </button>
    </div>
  );
}
