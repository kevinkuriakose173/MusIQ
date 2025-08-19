"use client";

import { useEffect, useState } from "react";
import TimeRangeSelect from "@/components/TimeRangeSelect";
import TrackList from "@/components/TrackList";
import ArtistGrid from "@/components/ArtistGrid";
import PlaybackControls from "@/components/PlaybackControls";
import DevicePicker from "@/components/DevicePicker";
import NowPlaying from "@/components/NowPlaying";
import LibraryRow from "@/components/LibraryRow";
import SearchOverlay from "@/components/SearchOverlay";
import AIPromptBox from "@/components/AIPromptBox";

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

type Track = any;
type Artist = any;

export default function Dashboard() {
  const [range, setRange] = useState<"short_term" | "medium_term" | "long_term">("short_term");
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (time_range = range) => {
    setLoading(true);
    setErr(null);
    try {
      const [rt, ra] = await Promise.all([
        fetch(`${B}/api/me/top-tracks?limit=20&time_range=${time_range}`, { credentials: "include" }),
        fetch(`${B}/api/me/top-artists?limit=20&time_range=${time_range}`, { credentials: "include" }),
      ]);
      if (!rt.ok) throw new Error(await rt.text());
      if (!ra.ok) throw new Error(await ra.text());
      const tracksJson = await rt.json();
      const artistsJson = await ra.json();
      setTracks(tracksJson.items || tracksJson.tracks || tracksJson);
      setArtists(artistsJson.items || artistsJson.artists || artistsJson);
    } catch (e: any) {
      setErr(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* initial */ }, []);
  useEffect(() => { load(range); }, [range]);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <SearchOverlay />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Your Dashboard</h1>
        <div className="flex gap-4 items-center">
          <DevicePicker />
          <PlaybackControls />
        </div>
      </header>
      
      <NowPlaying />
      <LibraryRow />

      <section className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Your Top</h2>
        <TimeRangeSelect value={range} onChange={setRange} />
      </section>

      {err && <div className="text-red-600">Error: {err}</div>}
      {loading && <div>Loading…</div>}

      {!loading && !err && (
        <>
          <section>
            <h3 className="text-xl font-semibold mb-3">Top Tracks</h3>
            {tracks ? <TrackList tracks={tracks} /> : <div>No tracks.</div>}
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Top Artists</h3>
            {artists ? <ArtistGrid artists={artists} /> : <div>No artists.</div>}
          </section>
        </>
      )}
      <AIPromptBox />
    </main>
  );
}
