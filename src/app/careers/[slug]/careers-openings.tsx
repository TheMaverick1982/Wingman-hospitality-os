"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
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

  // Dropdown lists specific locations only ("all" means show everything). The
  // all-locations roles (key "all") always show, since they apply everywhere.
  const locationOptions = groups.filter((g) => g.key !== "all");
  const showFilter = isMulti && locationOptions.length > 1;

  const visible =
    selected === "all"
      ? groups
      : groups.filter((g) => g.key === selected || g.key === "all");

  const applyHref = (o: OpeningLite) => `/apply/${slug}?opening=${o.id}&src=careers`;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 -mt-2">
        <p className="text-[16px] text-muted leading-relaxed">
          Here&rsquo;s everything we&rsquo;re hiring for right now{isMulti ? ", by location" : ""}. Tap a role to apply — it takes a couple of minutes.
        </p>
        {showFilter && (
          <div className="flex items-center gap-2 shrink-0 rounded-full border border-line bg-white px-3 py-1.5">
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

      {visible.map((g) => (
        <section key={g.key}>
          {g.name && <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-3">{g.name}</h2>}
          <div className="flex flex-col gap-3">
            {g.items.map((o) => (
              <div key={o.id} className="bg-white border border-line rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold text-ink">{roleLabel(o)}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px] text-muted-2">
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
        </section>
      ))}
    </div>
  );
}
