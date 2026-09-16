"use client";

import { useState, type ReactNode } from "react";

export type PageTab = { id: string; label: string; content: ReactNode };

// A lightweight in-page tab bar for dense sections (Hiring, Training, …) — the
// same pattern as the Guests surface: one calm row of tabs, each view short and
// focused instead of one long scroll. All panels stay mounted (toggled with
// `hidden`) so client state inside them survives a tab switch. Horizontally
// scrollable and edge-to-edge on phones.
export function PageTabs({ tabs, storageKey }: { tabs: PageTab[]; storageKey?: string }) {
  const visible = tabs.filter(Boolean);
  const [active, setActive] = useState<string>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && visible.some((t) => t.id === saved)) return saved;
      } catch { /* ignore */ }
    }
    return visible[0]?.id ?? "";
  });

  function choose(id: string) {
    setActive(id);
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, id); } catch { /* ignore */ }
    }
  }

  if (visible.length === 0) return null;
  if (visible.length === 1) return <div className="flex flex-col gap-6">{visible[0].content}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-5 sm:mx-0 px-5 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-line pb-px">
          {visible.map((t) => {
            const on = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                aria-current={on ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap text-sm font-semibold px-3.5 py-2.5 rounded-t-lg border-b-2 -mb-px transition-colors ${
                  on ? "border-brick text-brick" : "border-transparent text-charcoal-2 hover:text-ink hover:border-line-strong"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {visible.map((t) => (
        <div key={t.id} hidden={active !== t.id} className="flex flex-col gap-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}
