"use client";

type Artist = {
  id: string;
  name: string;
  genres?: string[];
  images?: { url: string }[];
  popularity?: number;
};

export default function ArtistGrid({ artists }: { artists: Artist[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {artists.map((a) => (
        <div key={a.id} className="p-4 rounded-xl border flex items-center gap-4">
          <img
            src={a.images?.[2]?.url || a.images?.[1]?.url || a.images?.[0]?.url}
            alt=""
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <div className="font-semibold">{a.name}</div>
            <div className="text-sm text-gray-500">{a.genres?.slice(0, 3).join(", ")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
