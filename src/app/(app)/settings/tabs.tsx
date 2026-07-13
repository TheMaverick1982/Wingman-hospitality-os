"use client";

import { useState } from "react";

type TabDef = { key: string; label: string; content: React.ReactNode };

export function SettingsTabs({ tabs }: { tabs: TabDef[] }) {
  const [tab, setTab] = useState<string>(tabs[0]?.key ?? "");
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <>
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-white border border-line rounded-xl p-1 self-start flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm font-semibold px-[18px] py-2.5 rounded-[9px] transition-colors ${
                (active?.key === t.key) ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active?.content}
    </>
  );
}
