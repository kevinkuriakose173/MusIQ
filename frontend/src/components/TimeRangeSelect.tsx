"use client";

type Props = {
  value: "short_term" | "medium_term" | "long_term";
  onChange: (v: "short_term" | "medium_term" | "long_term") => void;
};

export default function TimeRangeSelect({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-gray-500">Time range</span>
      <select
        className="border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as any)}
      >
        <option value="short_term">Last 4 weeks</option>
        <option value="medium_term">Last 6 months</option>
        <option value="long_term">All time</option>
      </select>
    </div>
  );
}
