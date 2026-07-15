"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search, MapPin, PhoneCall, MessageSquarePlus, Users, CircleDot, Clock, DollarSign } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/ui/status-pill";
import type { Location } from "@/lib/data/locations";
import {
  ACTIVITY_LABELS,
  daysSinceLastActivity,
  isFading,
  money,
  fmtDate,
  quarterStart,
  type PartnerActivityType,
  type PartnerContact,
} from "@/lib/partners";
import { ContactModal, type ContactFormValue } from "./contact-modal";
import { LogActivitySheet } from "./log-activity-sheet";
import { deleteContact, quickLogCallText } from "./actions";

type FeedActivity = {
  id: string;
  contact_id: string;
  location_id: string | null;
  activity_date: string;
  activity_type: PartnerActivityType;
  notes: string;
  revenue_cents: number | null;
  created_by: string | null;
  created_at: string;
  companyName: string;
  loggedBy: string;
};

type SortKey = "fading" | "company" | "recent" | "revenue";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "fading", label: "Needs Follow-up First" },
  { value: "company", label: "Company A–Z" },
  { value: "recent", label: "Recently Added" },
  { value: "revenue", label: "Highest Revenue" },
];

function relTouch(days: number | null): string {
  if (days === null) return "Never contacted";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function PartnersClient({
  contacts,
  activities,
  locations,
  assignableLocations,
  defaultLocationId,
  canEdit,
  canPickOrgWide,
  scopedLocationName,
  showLocationBadges,
}: {
  contacts: PartnerContact[];
  activities: FeedActivity[];
  locations: Location[];
  assignableLocations: Location[];
  defaultLocationId: string | null;
  canEdit: boolean;
  canPickOrgWide: boolean;
  scopedLocationName: string | null;
  showLocationBadges: boolean;
}) {
  const [tab, setTab] = useState<"contacts" | "activity">("contacts");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("fading");
  const [fadingOnly, setFadingOnly] = useState(false);
  const [modalContact, setModalContact] = useState<ContactFormValue | null | undefined>(undefined);
  const [sheet, setSheet] = useState<{ open: boolean; preselect: string | null }>({ open: false, preselect: null });
  const [, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const today = useMemo(() => new Date(now).toISOString().slice(0, 10), [now]);

  const locName = (id: string | null) => (id ? (locations.find((l) => l.id === id)?.name ?? null) : null);

  // Total revenue per contact (all time) — used for the revenue sort and row hint.
  const revenueByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      if (a.revenue_cents) m.set(a.contact_id, (m.get(a.contact_id) ?? 0) + a.revenue_cents);
    }
    return m;
  }, [activities]);

  // KPIs.
  const activeCount = useMemo(
    () => contacts.filter((c) => { const d = daysSinceLastActivity(c, now); return d !== null && d < 30; }).length,
    [contacts, now]
  );
  const fadingCount = useMemo(() => contacts.filter((c) => isFading(c, now)).length, [contacts, now]);
  const quarterRevenue = useMemo(() => {
    const start = quarterStart(today);
    return activities
      .filter((a) => a.revenue_cents && a.activity_date >= start)
      .reduce((s, a) => s + (a.revenue_cents ?? 0), 0);
  }, [activities, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = contacts;
    if (fadingOnly) list = list.filter((c) => isFading(c, now));
    if (q) {
      list = list.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.contact_name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === "company") {
      sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    } else if (sort === "recent") {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sort === "revenue") {
      sorted.sort((a, b) => (revenueByContact.get(b.id) ?? 0) - (revenueByContact.get(a.id) ?? 0));
    } else {
      // Needs-Follow-up first: most-stale (incl. never) at the top.
      const rank = (c: PartnerContact) => {
        const d = daysSinceLastActivity(c, now);
        return d === null ? Number.MAX_SAFE_INTEGER : d;
      };
      sorted.sort((a, b) => rank(b) - rank(a));
    }
    return sorted;
  }, [contacts, search, sort, fadingOnly, now, revenueByContact]);

  const contactOptions = useMemo(
    () => [...contacts].sort((a, b) => a.company_name.localeCompare(b.company_name)).map((c) => ({ id: c.id, company_name: c.company_name })),
    [contacts]
  );

  function openEdit(c: PartnerContact) {
    setModalContact({
      id: c.id,
      location_id: c.location_id,
      company_name: c.company_name,
      contact_name: c.contact_name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      category: c.category,
      subcategory: c.subcategory,
      website: c.website,
      address: c.address,
      notes: c.notes,
    });
  }

  function quickLog(id: string) {
    startTransition(async () => {
      await quickLogCallText(id);
    });
  }

  const fadeBadge = { label: "Needs Follow-up", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]", dot: "bg-[#D97706]" };
  const activeBadge = { label: "Active", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]", dot: "bg-[#16A34A]" };

  const searchBar = (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-full bg-white border border-line">
      <Search size={15} className="text-muted shrink-0" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by company, contact, category, or email…"
        className="text-sm outline-none w-full bg-transparent text-ink"
      />
    </div>
  );

  const sortControl = (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as SortKey)}
      className="text-sm rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none shrink-0"
      aria-label="Sort contacts"
    >
      {SORTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );

  const contactCards = (
    <div className="flex flex-col gap-2.5">
      {filtered.map((c) => {
        const days = daysSinceLastActivity(c, now);
        const fading = isFading(c, now);
        const badge = fading ? fadeBadge : activeBadge;
        const l = showLocationBadges ? locName(c.location_id) : null;
        const rev = revenueByContact.get(c.id) ?? 0;
        return (
          <div key={c.id} className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{c.company_name}</div>
                {(c.contact_name || c.category) && (
                  <div className="text-[13px] text-muted truncate mt-0.5">
                    {c.contact_name}
                    {c.contact_name && c.category ? " · " : ""}
                    {c.category}
                  </div>
                )}
                {l && (
                  <div className="flex items-center gap-1 text-xs text-muted-2 mt-1">
                    <MapPin size={12} className="shrink-0" />
                    {l}
                  </div>
                )}
              </div>
              <StatusPill {...badge} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[12.5px] text-muted-2">
              <span className={fading ? "text-[#B45309] font-medium" : ""}>Last touch: {relTouch(days)}</span>
              {rev > 0 && <span>Revenue: <span className="text-charcoal-2">{money(rev)}</span></span>}
              {c.phone && <span>{c.phone}</span>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
                <Btn small kind="ghost" icon={PhoneCall} onClick={() => quickLog(c.id)}>
                  Log call/text
                </Btn>
                <Btn small kind="ghost" icon={Pencil} onClick={() => openEdit(c)}>
                  Edit
                </Btn>
                <button onClick={() => deleteContact(c.id)} className="text-brick ml-auto p-1" aria-label="Delete contact">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted">
                No partners yet — add the local businesses around you to start building relationships.
              </p>
              {canEdit && (
                <Btn icon={Plus} onClick={() => setModalContact(null)}>
                  Add your first contact
                </Btn>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No contacts match your filters.</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Partners &amp; community</h1>
          {scopedLocationName ? (
            <p className="text-base text-muted">
              Local businesses for <span className="font-semibold text-ink">{scopedLocationName}</span>. Switch to{" "}
              <span className="font-semibold text-ink">All locations</span> up top to see every store.
            </p>
          ) : (
            <p className="text-base text-muted">
              Build relationships with the businesses around you — catering, group lunches, events, and fundraisers.
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Btn kind="ghost" icon={MessageSquarePlus} onClick={() => setSheet({ open: true, preselect: null })}>
              Log Activity
            </Btn>
            <Btn icon={Plus} onClick={() => setModalContact(null)}>
              Add Contact
            </Btn>
          </div>
        )}
      </div>

      {/* KPI cards. The Needs-Follow-up card doubles as a filter toggle. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Total contacts" value={contacts.length} sub="businesses you're tracking" />
        <StatTile label="Active connections" value={activeCount} sub="touched in the last 30 days" />
        <button type="button" onClick={() => setFadingOnly((v) => !v)} className="text-left">
          <StatTile
            label="Needs follow-up"
            value={fadingCount}
            sub={fadingOnly ? "Showing these — tap to clear" : "30+ days quiet or never — tap to filter"}
            trend={fadingCount > 0 ? "Follow up" : undefined}
            trendTone="down"
          />
        </button>
        <StatTile label="Revenue this quarter" value={money(quarterRevenue)} sub="booked from partners" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        {([["contacts", "Contacts", Users], ["activity", "Activity Feed", CircleDot]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? "border-brick text-brick" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "contacts" ? (
        <>
          {/* Mobile & tablet: search + sort + cards right under the tabs. */}
          <div className="lg:hidden flex flex-col gap-3">
            {searchBar}
            {sortControl}
            {contactCards}
          </div>

          {/* Desktop: search + sort row, then a table. */}
          <div className="hidden lg:flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg max-w-md w-full bg-white border border-line">
              <Search size={15} className="text-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, contact, category, or email…"
                className="text-sm outline-none w-full bg-transparent text-ink"
              />
            </div>
            {sortControl}
          </div>

          <div className="hidden lg:block bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-line">
                  {["Company", "Contact", "Category", showLocationBadges ? "Location" : "", "Last touch", "Status", ""].map((h, i) => (
                    <th key={i} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const days = daysSinceLastActivity(c, now);
                  const fading = isFading(c, now);
                  const badge = fading ? fadeBadge : activeBadge;
                  return (
                    <tr key={c.id} className="border-b border-line hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-5 py-3.5 text-ink font-medium">{c.company_name}</td>
                      <td className="px-5 py-3.5 text-muted">{c.contact_name || "—"}</td>
                      <td className="px-5 py-3.5 text-muted">{c.category || "—"}</td>
                      {showLocationBadges && <td className="px-5 py-3.5 text-muted">{locName(c.location_id) ?? "Org-wide"}</td>}
                      <td className={`px-5 py-3.5 tabular-nums ${fading ? "text-[#B45309] font-medium" : "text-muted"}`}>
                        {relTouch(days)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill {...badge} />
                      </td>
                      <td className="px-5 py-3.5">
                        {canEdit && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => quickLog(c.id)}
                              className="text-muted-2 hover:text-brick p-1.5"
                              aria-label="Log call or text"
                              title="Log call/text (resets the clock)"
                            >
                              <PhoneCall size={15} />
                            </button>
                            <Btn small kind="ghost" icon={Pencil} onClick={() => openEdit(c)}>
                              Edit
                            </Btn>
                            <button onClick={() => deleteContact(c.id)} className="text-brick p-1" aria-label="Delete contact">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center">
                      {contacts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-sm text-muted">
                            No partners yet — add the local businesses around you to start building relationships.
                          </p>
                          {canEdit && (
                            <Btn icon={Plus} onClick={() => setModalContact(null)}>
                              Add your first contact
                            </Btn>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted">No contacts match your filters.</p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <ActivityFeed activities={activities} now={now} locName={showLocationBadges ? locName : () => null} />
      )}

      {modalContact !== undefined && (
        <ContactModal
          contact={modalContact}
          assignableLocations={assignableLocations}
          defaultLocationId={defaultLocationId}
          canPickOrgWide={canPickOrgWide}
          onClose={() => setModalContact(undefined)}
        />
      )}
      {sheet.open && (
        <LogActivitySheet
          contacts={contactOptions}
          preselectContactId={sheet.preselect}
          onClose={() => setSheet({ open: false, preselect: null })}
        />
      )}
    </>
  );
}

function ActivityFeed({
  activities,
  now,
  locName,
}: {
  activities: FeedActivity[];
  now: number;
  locName: (id: string | null) => string | null;
}) {
  const todayStr = new Date(now).toISOString().slice(0, 10);
  if (activities.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
        <p className="text-sm text-muted">No activity logged yet. Log a call, email, or meeting to start the history.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm divide-y divide-line">
      {activities.map((a) => {
        const l = locName(a.location_id);
        const isToday = a.activity_date.slice(0, 10) === todayStr;
        return (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
            <div className="mt-0.5 w-8 h-8 rounded-full bg-brick-tint text-brick flex items-center justify-center shrink-0">
              {a.activity_type === "call_text" ? (
                <PhoneCall size={15} />
              ) : a.activity_type === "email" ? (
                <MessageSquarePlus size={15} />
              ) : a.revenue_cents ? (
                <DollarSign size={15} />
              ) : (
                <Clock size={15} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-ink truncate">{a.companyName}</span>
                <span className="text-xs text-muted-2 shrink-0 tabular-nums">{isToday ? "Today" : fmtDate(a.activity_date)}</span>
              </div>
              <div className="text-[13px] text-muted mt-0.5">
                {ACTIVITY_LABELS[a.activity_type]}
                {a.revenue_cents ? <span className="text-[#15803D] font-medium"> · {money(a.revenue_cents)}</span> : ""}
                {l ? <span className="text-muted-2"> · {l}</span> : ""}
                {a.loggedBy ? <span className="text-muted-2"> · by {a.loggedBy}</span> : ""}
              </div>
              {a.notes && <div className="text-[13px] text-charcoal-2 mt-1 whitespace-pre-wrap">{a.notes}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
