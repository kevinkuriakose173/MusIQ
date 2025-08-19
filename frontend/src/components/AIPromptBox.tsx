"use client";

import { JSX, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import PlaylistPickerModal from "./PlaylistPickerModal";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type ResolvedTrack = {
  query: { artist?: string; track?: string };
  type?: "track" | "artist";
  track?: { id: string; uri: string; name: string; artist_names: string[]; image?: string };
  artist?: { id: string; uri: string; name: string; image?: string };
};
type AIResponse = { candidates?: { artist?: string; track?: string }[] };

export default function AIAssistOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL param ?ai=
  const urlAI = searchParams.get("ai") ?? "";
  const hasAIParam = searchParams.has("ai");

  const [open, setOpen] = useState<boolean>(hasAIParam);
  const [prompt, setPrompt] = useState<string>(urlAI);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedTrack[]>([]);
  const [playlistOpenForTrackId, setPlaylistOpenForTrackId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // hotkeys (⌘/Ctrl+I to toggle; arrow nav / enter to play when NOT in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        !!target?.closest('input,textarea,[contenteditable="true"]') ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";

      const isModI = e.key.toLowerCase() === "i" && (e.metaKey || e.ctrlKey);
      if (isModI) {
        e.preventDefault();
        toggleOpen();
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (!inEditable && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (!resolved.length) return;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const ni = (focusIndex + dir + resolved.length) % resolved.length;
        setFocusIndex(ni);
        const el = listRef.current?.querySelector(`[data-idx="${ni}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
      } else if (!inEditable && e.key === "Enter") {
        e.preventDefault();
        const item = resolved[focusIndex];
        if (item?.track) playTrack(item.track.uri);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focusIndex, resolved]);

  // keep state in sync with URL when it changes elsewhere
  useEffect(() => {
    setOpen(hasAIParam);
    setPrompt(urlAI);
  }, [hasAIParam, urlAI]);

  // keep URL updated while open
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!open) {
      sp.delete("ai");
    } else {
      if (!sp.has("ai")) sp.set("ai", prompt);
      else sp.set("ai", prompt);
    }
    router.replace(`${pathname}?${sp.toString()}`.replace(/\?$/, ""), { scroll: false });
  }, [open, prompt, pathname, router, searchParams]);

  const toggleOpen = () => {
    setOpen(o => !o);
    // focus input when opening
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setResolved([]);
    setPrompt("");
    setFocusIndex(0);
    setPlaylistOpenForTrackId(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("ai");
    router.replace(`${pathname}?${sp.toString()}`.replace(/\?$/, ""), { scroll: false });
  }, [pathname, router, searchParams]);

  // ---- core: run AI ONLY when user submits ----
  const runAI = async () => {
    const p = (prompt ?? "").trim();
    if (p.length < 2) {
      setResolved([]);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // 1) ask your Flask AI route
      const r1 = await fetch(`${B}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
        signal: ctrl.signal,
      });
      if (!r1.ok) throw new Error(await r1.text());
      const raw1 = await r1.json();
      const ai: AIResponse = typeof raw1 === "string" ? JSON.parse(raw1) : raw1;

      const candidates = ai?.candidates ?? [];
      if (!candidates.length) {
        setResolved([]);
        setErr(null);
        return;
      }

      // 2) resolve to Spotify objects
      const r2 = await fetch(`${B}/spotify-tools/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates }),
        signal: ctrl.signal,
      });
      if (!r2.ok) throw new Error(await r2.text());
      const raw2 = await r2.json();
      const items: ResolvedTrack[] = raw2?.resolved ?? [];
      setResolved(items);
      setFocusIndex(0);

      queueMicrotask(() => {
        const el = listRef.current?.querySelector('[data-idx="0"]') as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr(e?.message || "AI request failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  // submit handler (Enter key in the input or clicking Ask)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAI();
  };

  // actions
  const playTrack = async (trackUri: string) => {
    await fetch(`${B}/api/player/play`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [trackUri] }),
    });
  };
  const addSingleToPlaylist = async (playlistId: string, trackUri: string) => {
    await fetch(`${B}/spotify-tools/add-to-playlist`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlist_id: playlistId, track_uris: [trackUri] }),
    });
  };

  const row = (
    idx: number,
    img: string | undefined,
    title: string,
    subtitle: string,
    onClick: () => void,
    reactKey?: string
  ) => {
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
        {img ? <img src={img} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-neutral-700" aria-hidden />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          <div className="truncate text-xs text-neutral-400">{subtitle}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 🤖 button to open AI */}
      <button
        onClick={toggleOpen}
        className="p-2 rounded hover:bg-neutral-800 flex items-center gap-2"
        title="AI (⌘I)"
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline">AI</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
          <div
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 rounded-xl overflow-hidden shadow-lg bg-neutral-900 border border-neutral-700"
            role="dialog" aria-modal="true" aria-labelledby="ai-label"
          >
            {/* prompt form */}
            <form onSubmit={onSubmit} className="p-3 border-b border-neutral-700 flex gap-2">
              <input
                ref={inputRef}
                id="ai-label"
                className="w-full px-3 py-2 rounded bg-neutral-800 outline-none text-white"
                placeholder='Try: "Recommend songs like Hotline Bling"'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50"
                disabled={loading || !prompt.trim()}
              >
                {loading ? "Thinking…" : "Ask"}
              </button>
            </form>

            {/* results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto divide-y divide-neutral-800">
              {loading && <div className="p-4 text-center text-neutral-400">Loading…</div>}
              {err && <div className="p-4 text-center text-red-400">{err}</div>}
              {!loading && !err && prompt.trim() && resolved.length === 0 && (
                <div className="p-4 text-center text-neutral-400">No suggestions yet</div>
              )}

              {resolved.map((r, idx) => {
                if (r.track) {
                  const t = r.track;
                  const subtitle = t.artist_names.join(", ");
                  return (
                    <div key={`trk-${t.id}`}>
                      {row(idx, t.image, t.name, subtitle, () => playTrack(t.uri), `row-${t.id}`)}
                      <div className="px-3 pb-3 flex gap-2">
                        <button className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => playTrack(t.uri)}>
                          ▶ Play
                        </button>
                        <button className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => setPlaylistOpenForTrackId(t.id)}>
                          ＋ Add to playlist
                        </button>
                      </div>

                      {playlistOpenForTrackId === t.id && (
                        <PlaylistPickerModal
                          open
                          onClose={() => setPlaylistOpenForTrackId(null)}
                          onSelect={async (plId: string) => {
                            await addSingleToPlaylist(plId, t.uri);
                            setPlaylistOpenForTrackId(null);
                          }}
                        />
                      )}
                    </div>
                  );
                }
                if (r.artist) {
                  const a = r.artist;
                  return row(idx, a.image, a.name, "Artist", () => window.open(`https://open.spotify.com/artist/${a.id}`, "_blank"), `row-${a.id}`);
                }
                return null;
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
