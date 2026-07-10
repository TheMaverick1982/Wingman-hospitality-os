"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  { key: "7", label: "7 days" },
  { key: "28", label: "28 days" },
  { key: "90", label: "90 days" },
];

export function DateRangePicker({ preset, start, end }: { preset: string; start: string; end: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);

  function applyCustom() {
    if (!from || !to) return;
    router.push(`/admin/analytics?start=${from}&end=${to}`);
  }

  const inputCls = "rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brick";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-full bg-paper p-1 border border-line">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/analytics?days=${p.key}`}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
              preset === p.key ? "bg-white text-ink shadow-sm" : "text-muted-2 hover:text-ink"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <span className="text-muted-2 text-sm">–</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        <button
          type="button"
          onClick={applyCustom}
          disabled={!from || !to}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
            preset === "custom" ? "bg-brick text-white" : "bg-ink text-white hover:bg-black"
          } disabled:opacity-40`}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
