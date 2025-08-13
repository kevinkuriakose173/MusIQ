"use client";

type Track = {
  id: string;
  name: string;
  uri: string;
  popularity?: number;
  artists: { name: string }[];
  album: { images?: { url: string }[] };
};

export default function TrackList({ tracks }: { tracks: Track[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {tracks.map((t, i) => (
        <div key={t.id} className="flex gap-3 items-center p-3 rounded-xl border">
          <div className="w-12 text-right text-sm text-gray-500">{i + 1}</div>
          <img
            src={t.album?.images?.[2]?.url || t.album?.images?.[1]?.url || t.album?.images?.[0]?.url}
            alt=""
            className="w-12 h-12 rounded object-cover"
          />
          <div className="flex-1">
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-500">
              {t.artists.map(a => a.name).join(", ")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
