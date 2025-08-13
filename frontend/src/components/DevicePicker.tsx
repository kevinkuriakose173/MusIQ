"use client";

import { useEffect, useState } from "react";

type Device = {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted?: boolean;
  volume_percent?: number;
};

const B = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function DevicePicker() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r = await fetch(`${B}/api/player/devices`, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    setDevices(Array.isArray(data?.devices) ? data.devices : []);
  };

  const transfer = async (device_id: string) => {
    if (!device_id) return; // avoid transferring to invalid devices
    setLoading(true);
    try {
      const url = new URL(`${B}/api/player/transfer`);
      url.searchParams.set("device_id", device_id);
      const r = await fetch(url.toString(), { method: "PUT", credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex items-center gap-3">
      <button className="px-3 py-2 rounded border" onClick={load}>
        🔄 Refresh Devices
      </button>
      <select
        className="border rounded px-2 py-1"
        disabled={loading}
        onChange={(e) => transfer(e.target.value)}
        defaultValue=""
      >
        <option value="" disabled>Transfer playback…</option>
        {devices.map((d, idx) => (
          <option
            key={d.id || `${d.name}-${idx}`}
            value={d.id || ""}
            disabled={!d.id}
          >
            {d.is_active ? "✅ " : ""}{d.name} ({d.type})
            {!d.id ? " • unavailable" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
