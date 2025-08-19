"use client";

import { useEffect, useState } from "react";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type Img = { url: string; width?: number; height?: number };
type Playlist = {
  id: string;
  name: string;
  images?: Img[];
  owner?: { display_name?: string };
};

export default function PlaylistPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (playlistId: string) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`${B}/api/me/playlists?limit=50`, {
          credentials: "include",
        });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json(); // your /api/me/playlists returns items in data.items or just array; normalize:
        const items: Playlist[] = (data?.items ?? data) as Playlist[];
        setPlaylists(items.filter(Boolean));
      } catch (e: any) {
        setErr(e?.message || "Failed to load playlists");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 rounded-xl overflow-hidden shadow-lg bg-neutral-900 border border-neutral-700">
        <div className="p-3 border-b border-neutral-700">
          <div className="text-sm font-medium">Choose a playlist</div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && <div className="p-4 text-center text-neutral-400">Loading…</div>}
          {err && <div className="p-4 text-center text-red-400">{err}</div>}
          {!loading && !err && playlists.length === 0 && (
            <div className="p-4 text-center text-neutral-400">No playlists</div>
          )}
          {playlists.map((p) => {
            const img = p.images?.[0]?.url ?? "";
            return (
              <button
                key={p.id}
                onClick={async () => {
                  await onSelect(p.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800"
              >
                {img ? (
                  <img src={img} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-700" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {p.owner?.display_name ?? "—"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-neutral-700 flex justify-end">
          <button
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
