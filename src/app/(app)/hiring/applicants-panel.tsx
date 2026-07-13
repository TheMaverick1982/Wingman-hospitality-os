"use client";

import { useState, useTransition } from "react";
import { Inbox, Paperclip, Trash2, CalendarClock, Link2, Check, Code2, ImagePlus } from "lucide-react";
import { updateApplicationStatus, confirmInterview, getResumeUrl, deleteApplication, updateApplicationsCc, uploadOrgLogo, removeOrgLogo } from "./applicant-actions";

export type Applicant = {
  id: string;
  name: string;
  department: string;
  locationId: string | null;
  locationName: string;
  email: string;
  phone: string;
  availability: string;
  message: string;
  hasResume: boolean;
  preferredVisitAt: string | null;
  interviewAt: string | null;
  interviewDetails: string;
  status: string;
  createdAt: string;
};

const STATUS: { value: string; label: string; cls: string }[] = [
  { value: "new", label: "New", cls: "bg-brick-tint text-brick-dark" },
  { value: "contacted", label: "Contacted", cls: "bg-[#FDF3E1] text-[#B45309]" },
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

export function ApplicantsPanel({ applicants, applyUrl, applicationsCc, logoUrl }: { applicants: Applicant[]; applyUrl: string | null; applicationsCc: string; logoUrl: string | null }) {
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [cc, setCc] = useState(applicationsCc);
  const [ccMsg, setCcMsg] = useState<string | null>(null);
  const [ccPending, startCc] = useTransition();
  const [logo, setLogo] = useState(logoUrl);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoPending, startLogo] = useTransition();

  const embedCode = applyUrl ? `<iframe src="${applyUrl}?embed=1" title="Job application" style="width:100%;max-width:640px;border:0;min-height:760px"></iframe>` : "";

  function uploadLogo(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("logo", file);
    startLogo(async () => {
      const res = await uploadOrgLogo(fd);
      if (res.error) setLogoMsg(res.error);
      else { setLogo(res.url ?? null); setLogoMsg("Logo saved."); }
      setTimeout(() => setLogoMsg(null), 2500);
    });
  }
  function dropLogo() {
    startLogo(async () => { await removeOrgLogo(); setLogo(null); });
  }
  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).then(() => { setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2000); });
  }
  const counts = STATUS.reduce((m, s) => ({ ...m, [s.value]: applicants.filter((a) => a.status === s.value).length }), {} as Record<string, number>);
  const shown = filter === "all" ? applicants : applicants.filter((a) => a.status === filter);

  function copyLink() {
    if (!applyUrl) return;
    navigator.clipboard.writeText(applyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function saveCc() {
    startCc(async () => {
      const res = await updateApplicationsCc(cc);
      setCcMsg(res.error ? res.error : "Saved.");
      setTimeout(() => setCcMsg(null), 2500);
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
          <div className="flex items-center gap-2">
            <button onClick={copyLink} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-2 hover:border-brick hover:text-brick transition-colors">
              {copied ? <Check size={14} className="text-[#15803d]" /> : <Link2 size={14} />}
              {copied ? "Link copied" : "Copy application link"}
            </button>
            <button onClick={() => setShowEmbed((v) => !v)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-2 hover:border-brick hover:text-brick transition-colors">
              <Code2 size={14} /> Embed
            </button>
          </div>
        )}
      </div>

      {showEmbed && applyUrl && (
        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-ink">Embed on your website</label>
            <button onClick={copyEmbed} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick hover:text-brick-dark">
              {embedCopied ? <Check size={13} className="text-[#15803d]" /> : <Code2 size={13} />} {embedCopied ? "Copied" : "Copy code"}
            </button>
          </div>
          <textarea readOnly value={embedCode} onFocus={(e) => e.currentTarget.select()} rows={2} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-mono text-charcoal-2 outline-none" />
          <p className="text-[12px] text-muted-2 mt-1.5">Paste this into your site&rsquo;s HTML to show the application form inline — no Wingman branding.</p>
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-line">
          <div>
            <div className="text-[13px] font-semibold text-ink">Logo on the form</div>
            <p className="text-[12px] text-muted-2 mt-0.5">Shown at the top of your application page.</p>
          </div>
          <div className="flex items-center gap-2">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="h-9 w-auto max-w-[120px] object-contain rounded" />
            )}
            <label className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-2 cursor-pointer hover:border-brick hover:text-brick ${logoPending ? "opacity-60" : ""}`}>
              <ImagePlus size={14} /> {logo ? "Replace" : "Upload"}
              <input type="file" accept="image/*" className="sr-only" disabled={logoPending} onChange={(e) => uploadLogo(e.target.files)} />
            </label>
            {logo && <button onClick={dropLogo} disabled={logoPending} className="text-muted-2 hover:text-danger disabled:opacity-50" title="Remove logo"><Trash2 size={15} /></button>}
          </div>
        </div>
        {logoMsg && <p className="text-[12px] text-olive font-semibold mb-2">{logoMsg}</p>}

        <label className="text-[13px] font-semibold text-ink block mb-1.5">Also copy applications to</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="office@yourplace.com, gm@yourplace.com — add multiple, separated by commas"
            className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brick"
          />
          <button onClick={saveCc} disabled={ccPending} className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50 shrink-0">
            {ccPending ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-[12px] text-muted-2 mt-1.5">Every new application is emailed to the location&rsquo;s address on file — these addresses always get a copy too. {ccMsg && <span className="text-olive font-semibold">{ccMsg}</span>}</p>
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
  const [when, setWhen] = useState(toLocalInput(a.interviewAt));
  const [details, setDetails] = useState(a.interviewDetails);
  const [scheduling, setScheduling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = toneOf(status);

  function changeStatus(next: string) {
    setStatus(next);
    start(async () => { await updateApplicationStatus(a.id, next); });
  }
  function confirm_() {
    start(async () => {
      const res = await confirmInterview(a.id, when, details);
      if (res.error) { setMsg(res.error); setTimeout(() => setMsg(null), 2500); }
      // On success the row moves to the candidates area; revalidate refetches.
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
      {a.preferredVisitAt && <div className="text-[13px] text-muted mt-1"><span className="font-semibold text-charcoal-2">Wants to come in:</span> {new Date(a.preferredVisitAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
      {a.message && <p className="text-[13px] text-muted mt-1 whitespace-pre-wrap">{a.message}</p>}

      <div className="mt-3 pt-3 border-t border-line">
        {!scheduling ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11.5px] font-semibold text-muted block mb-1">Status</label>
              <select value={status} onChange={(e) => changeStatus(e.target.value)} disabled={pending} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-brick">
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {a.hasResume && (
              <button onClick={openResume} disabled={pending} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/30 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50">
                <Paperclip size={13} /> Resume
              </button>
            )}
            <button onClick={() => setScheduling(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark">
              <CalendarClock size={13} /> Schedule interview
            </button>
            {msg && <span className="text-[12.5px] text-danger self-center">{msg}</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="text-[12.5px] font-semibold text-ink">Schedule the interview — this moves them into your candidates.</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick" />
              <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details — who's interviewing, where, what to bring…" className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={confirm_} disabled={pending || !when} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
                <Check size={14} /> {pending ? "Confirming…" : "Confirm interview"}
              </button>
              <button onClick={() => setScheduling(false)} className="text-[13px] font-semibold text-muted-2 hover:text-ink">Cancel</button>
              {msg && <span className="text-[12.5px] text-danger self-center">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
