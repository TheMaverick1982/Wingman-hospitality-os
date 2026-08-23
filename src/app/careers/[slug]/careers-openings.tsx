"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, ChevronDown } from "lucide-react";
import { ShowMoreText } from "./show-more-text";

export type OpeningLite = {
  id: string;
  department: string;
  title: string | null;
  ad_copy: string;
  pay_note: string | null;
  employment_type: string | null;
};
export type Group = { key: string; name: string; items: OpeningLite[] };

const roleLabel = (o: OpeningLite) => o.title?.trim() || o.department;

export function CareersOpenings({ slug, groups, isMulti }: { slug: string; groups: Group[]; isMulti: boolean }) {
  const [selected, setSelected] = useState<string>("all");
  const [query, setQuery] = useState("");
  // Which location sections the visitor has expanded (only used in the default
  // browse state; search/location-filter force the relevant sections open).
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Location dropdown lists specific locations only ("all" means show everything).
  // The all-locations roles (key "all") always show, since they apply everywhere.
  const locationOptions = groups.filter((g) => g.key !== "all");
  const showFilter = isMulti && locationOptions.length > 1;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = (o: OpeningLite) =>
    !q ||
    roleLabel(o).toLowerCase().includes(q) ||
    (o.employment_type ?? "").toLowerCase().includes(q) ||
    (o.pay_note ?? "").toLowerCase().includes(q) ||
    (o.ad_copy ?? "").toLowerCase().includes(q);

  // Apply the location filter, then the search, dropping any section left empty.
  const visible = useMemo(() => {
    const byLoc =
      selected === "all" ? groups : groups.filter((g) => g.key === selected || g.key === "all");
    return byLoc
      .map((g) => ({ ...g, items: g.items.filter(matches) }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, selected, q]);

  const totalShown = visible.reduce((n, g) => n + g.items.length, 0);
  // Sections collapse only while browsing everything; a search or a picked
  // location shows the matching roles expanded so nothing needs a second click.
  const collapsible = isMulti && !searching && selected === "all" && visible.length > 1;
  const allExpanded = collapsible && visible.every((g) => openKeys.has(g.key));

  const isOpen = (key: string) => (collapsible ? openKeys.has(key) : true);
  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setAll = (open: boolean) => setOpenKeys(open ? new Set(visible.map((g) => g.key)) : new Set());

  const applyHref = (o: OpeningLite) => `/apply/${slug}?opening=${o.id}&src=careers`;
  const detailHref = (o: OpeningLite) => `/careers/${slug}/${o.id}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 -mt-2">
        <p className="text-[16px] text-muted leading-relaxed">
          Here&rsquo;s everything we&rsquo;re hiring for right now{isMulti ? ", by location" : ""}. Tap a role to apply — it takes a couple of minutes.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-2 flex-1 rounded-full border border-line bg-white px-3.5 py-2">
            <Search size={15} className="text-muted-2 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles — e.g. server, chef, part-time"
              aria-label="Search roles"
              className="w-full text-[14px] bg-transparent outline-none text-charcoal-2 placeholder:text-muted-2"
            />
          </div>
          {showFilter && (
            <div className="flex items-center gap-2 shrink-0 rounded-full border border-line bg-white px-3 py-2">
              <MapPin size={14} className="text-muted-2" />
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Filter by location"
                className="text-[13.5px] font-semibold bg-transparent outline-none pr-1 text-charcoal-2"
              >
                <option value="all">All locations</option>
                {locationOptions.map((g) => (
                  <option key={g.key} value={g.key}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-muted-2">
            {totalShown === 0
              ? "No roles match your search."
              : `${totalShown} open ${totalShown === 1 ? "role" : "roles"}${isMulti && !searching && selected === "all" ? ` across ${visible.length} ${visible.length === 1 ? "location" : "locations"}` : ""}`}
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => setAll(!allExpanded)}
              className="text-[12.5px] font-semibold text-brick hover:text-brick-dark shrink-0"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      </div>

      {visible.map((g) => {
        const open = isOpen(g.key);
        const hasHeader = Boolean(g.name);
        return (
          <section key={g.key} className="border border-line rounded-2xl bg-white shadow-sm overflow-hidden">
            {hasHeader && (
              <button
                type="button"
                onClick={collapsible ? () => toggle(g.key) : undefined}
                aria-expanded={open}
                className={`w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left ${collapsible ? "cursor-pointer hover:bg-paper/50" : "cursor-default"}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px] font-semibold text-ink truncate">{g.name}</span>
                  <span className="text-[12px] font-semibold text-muted-2 bg-paper border border-line rounded-full px-2 py-0.5 shrink-0">
                    {g.items.length}
                  </span>
                </span>
                {collapsible && (
                  <ChevronDown size={18} className={`text-muted-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                )}
              </button>
            )}
            {open && (
              <div className={`px-5 sm:px-6 pb-2 ${hasHeader ? "border-t border-line pt-1" : "pt-4"}`}>
                {g.items.map((o) => (
                  <div key={o.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 py-4 border-t border-line first:border-t-0">
                    <div className="min-w-0">
                      <a href={detailHref(o)} className="text-[16px] font-semibold text-ink hover:text-brick transition-colors">{roleLabel(o)}</a>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[13px] text-muted-2">
                        {o.employment_type && <span className="font-medium">{o.employment_type}</span>}
                        {o.employment_type && o.pay_note?.trim() && <span>·</span>}
                        {o.pay_note?.trim() && <span className="font-medium text-charcoal-2">{o.pay_note.trim()}</span>}
                      </div>
                      {o.ad_copy?.trim() && <ShowMoreText text={o.ad_copy.trim()} />}
                    </div>
                    <a
                      href={applyHref(o)}
                      className="shrink-0 self-start inline-flex items-center justify-center text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
                    >
                      Apply
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
