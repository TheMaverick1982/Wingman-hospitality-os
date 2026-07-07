"use client";

import { useState } from "react";

const TABS = [
  { key: "team", label: "Team & permissions" },
  { key: "locations", label: "Locations" },
  { key: "billing", label: "Billing" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsTabs({
  team,
  locations,
  billing,
}: {
  team: React.ReactNode;
  locations: React.ReactNode;
  billing: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("team");

  return (
    <>
      <div className="flex gap-1 bg-white border border-line rounded-xl p-1 self-start">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm font-semibold px-[18px] py-2.5 rounded-[9px] transition-colors ${
              tab === t.key ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "team" && team}
      {tab === "locations" && locations}
      {tab === "billing" && billing}
    </>
  );
}
