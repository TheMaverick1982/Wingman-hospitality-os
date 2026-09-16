"use client";

import { useEffect, useState, type ReactNode } from "react";

export type PageTab = { id: string; label: string; content: ReactNode };

// A lightweight in-page tab bar for dense sections (Hiring, Training, …) — the
// same pattern as the Guests surface: one calm row of tabs, each view short and
// focused instead of one long scroll. All panels stay mounted (the inactive ones
// get the `hidden` class) so client state inside them survives a tab switch.
// Horizontally scrollable and edge-to-edge on phones.
//
// Deep-linkable: if the URL hash matches a tab id (e.g. /training#menu), that tab
// opens on load, and following an in-page #id link switches to it live. This is
// how "Menu section under Training" links land you ON the Menu tab.
export function PageTabs({ tabs, storageKey }: { tabs: PageTab[]; storageKey?: string }) {
  const visible = tabs.filter(Boolean);
  const [active, setActive] = useState<string>(() => {
    // Hash wins over the remembered tab so a deep link always lands where it says.
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && visible.some((t) => t.id === hash)) return hash;
      if (storageKey) {
        try {
          const saved = window.localStorage.getItem(storageKey);
          if (saved && visible.some((t) => t.id === saved)) return saved;
        } catch { /* ignore */ }
      }
    }
    return visible[0]?.id ?? "";
  });

  // Follow a hash change during the session (e.g. tapping an in-page "#menu"
  // link, or the browser back/forward changing the hash).
  useEffect(() => {
    function onHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && visible.some((t) => t.id === hash)) setActive(hash);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // visible identity changes each render but the ids are stable; guarding on the
    // joined id list keeps the listener correct without re-subscribing constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((t) => t.id).join(",")]);

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
      {/* Inactive panels use the `hidden` utility class — NOT the `hidden`
          attribute. In Tailwind v4 the attribute's rule lives in @layer base with
          zero specificity, so the `flex` utility (in @layer utilities) overrides
          it and the panel stays visible, stacking every tab's content and
          swallowing clicks. Applying the class conditionally, with no `flex` on an
          inactive panel, hides it reliably. */}
      {visible.map((t) => (
        <div key={t.id} className={active === t.id ? "flex flex-col gap-6" : "hidden"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
