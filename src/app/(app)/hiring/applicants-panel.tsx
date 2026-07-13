"use client";

import { useState, useTransition } from "react";
import { Inbox, Paperclip, Trash2, CalendarClock, Link2, Check } from "lucide-react";
import { updateApplicationStatus, scheduleApplicationVisit, getResumeUrl, deleteApplication } from "./applicant-actions";

export type Applicant = {
  id: string;
  name: string;
  department: string;
  locationName: string;
  email: string;
  phone: string;
  availability: string;
  message: string;
  hasResume: boolean;
  preferredVisitAt: string | null;
  status: string;
  createdAt: string;
};

const STATUS: { value: string; label: string; cls: string }[] = [
  { value: "new", label: "New", cls: "bg-brick-tint text-brick-dark" },
  { value: "contacted", label: "Contacted", cls: "bg-[#FDF3E1] text-[#B45309]" },
  { value: "hired", label: "Hired", cls: "bg-[#E7F6EC] text-[#15803D]" },
  { value: "not_a_fit", label: "Not a fit", cls: "bg-[#F1F1F1] text-charcoal-2" },
];
const toneOf = (s: string) => STATUS.find((x) => x.value === s) ?? STATUS[0];

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ApplicantsPanel({ applicants, applyUrl }: { applicants: Applicant[]; applyUrl: string | null }) {
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const counts = STATUS.reduce((m, s) => ({ ...m, [s.value]: applicants.filter((a) => a.status === s.value).length }), {} as Record<string, number>);
  const shown = filter === "all" ? applicants : applicants.filter((a) => a.status === filter);

  function copyLink() {
    if (!applyUrl) return;
    navigator.clipboard.writeText(applyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox size={18} className="text-brick" />
          <h3 className="font-display text-lg font-semibold text-ink">Applicants</h3>
          <span className="text-[13px] text-muted">· {applicants.length} total</span>
        </div>
        {applyUrl && (
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-2 hover:border-brick hover:text-brick transition-colors">
            {copied ? <Check size={14} className="text-[#15803d]" /> : <Link2 size={14} />}
            {copied ? "Link copied" : "Copy application link"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {[{ value: "all", label: "All" }, ...STATUS].map((f) => {
          const n = f.value === "all" ? applicants.length : counts[f.value] ?? 0;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.value ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              {f.label} {n > 0 && <span className="tabular-nums">· {n}</span>}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted">
            {applicants.length === 0
              ? "No applications yet. Share your application link (Hiring → get the link) or embed the form on your site."
              : "Nothing in this status."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((a) => <ApplicantCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function ApplicantCard({ a }: { a: Applicant }) {
  const [status, setStatus] = useState(a.status);
  const [visit, setVisit] = useState(toLocalInput(a.preferredVisitAt));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = toneOf(status);

  function changeStatus(next: string) {
    setStatus(next);
    start(async () => { await updateApplicationStatus(a.id, next); });
  }
  function saveVisit() {
    start(async () => {
      const res = await scheduleApplicationVisit(a.id, visit);
      setMsg(res.error ? res.error : "Visit saved.");
      setTimeout(() => setMsg(null), 2500);
    });
  }
  function openResume() {
    start(async () => {
      const res = await getResumeUrl(a.id);
      if (res.url) window.open(res.url, "_blank", "noopener");
      else setMsg(res.error);
    });
  }
  function remove() {
    if (!confirm(`Remove ${a.name}'s application?`)) return;
    start(async () => { await deleteApplication(a.id); });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-ink">{a.name}</span>
            <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full ${tone.cls}`}>{tone.label}</span>
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {a.department || "Any role"}{a.locationName ? ` · ${a.locationName}` : ""} · applied {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
        <button onClick={remove} disabled={pending} className="text-muted-2 hover:text-danger disabled:opacity-50 shrink-0" title="Remove"><Trash2 size={15} /></button>
      </div>

      {(a.email || a.phone) && <div className="text-[13px] text-charcoal-2">{[a.email, a.phone].filter(Boolean).join(" · ")}</div>}
      {a.availability && <div className="text-[13px] text-muted mt-1"><span className="font-semibold text-charcoal-2">Availability:</span> {a.availability}</div>}
      {a.message && <p className="text-[13px] text-muted mt-1 whitespace-pre-wrap">{a.message}</p>}

      <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-line">
        <div>
          <label className="text-[11.5px] font-semibold text-muted block mb-1">Status</label>
          <select value={status} onChange={(e) => changeStatus(e.target.value)} disabled={pending} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-brick">
            {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11.5px] font-semibold text-muted block mb-1">Visit</label>
          <div className="flex items-center gap-1.5">
            <input type="datetime-local" value={visit} onChange={(e) => setVisit(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brick" />
            <button onClick={saveVisit} disabled={pending} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1.5 hover:border-brick hover:text-brick disabled:opacity-50"><CalendarClock size={13} /> Save</button>
          </div>
        </div>
        {a.hasResume && (
          <button onClick={openResume} disabled={pending} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/30 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50">
            <Paperclip size={13} /> Resume
          </button>
        )}
        {msg && <span className="text-[12.5px] text-muted self-center">{msg}</span>}
      </div>
    </div>
  );
}
