"use client";

import { useState, useTransition } from "react";
import { Inbox, Paperclip, Trash2, CalendarClock, Link2, Check, Code2, ImagePlus, SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { updateApplicationStatus, confirmInterview, getResumeUrl, deleteApplication, updateApplicationsCc, uploadOrgLogo, removeOrgLogo, updateApplySlug } from "./applicant-actions";
import { ApplicationFormEditor } from "./application-form-editor";
import type { ApplicationFormConfig, CustomAnswer } from "@/lib/application-form";
import { AXIS_LABEL, TIER_META, type ScreeningGrade, type ScreeningAnswer, type ScreeningTier } from "@/lib/screening";

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
  customAnswers: CustomAnswer[];
  screeningGrade: ScreeningGrade | null;
  screeningAnswers: ScreeningAnswer[];
};

// The pre-interview screening read: a tier chip, a per-axis 1–5 score with the
// AI's one-line reasoning, and the candidate's own answers on demand. Advisory —
// it never changes the applicant's status; the manager still decides.
function ScreeningGradeBlock({ grade, answers }: { grade: ScreeningGrade; answers: ScreeningAnswer[] }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const tier = TIER_META[grade.tier];
  const axes: { key: "hospitality" | "follows_instructions"; g: { score: number; rationale: string } }[] = [
    { key: "hospitality", g: grade.hospitality },
    { key: "follows_instructions", g: grade.followsInstructions },
  ];
  return (
    <div className="mt-3 rounded-xl border border-line bg-paper/60 p-3.5">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${tier.bg} ${tier.fg}`}>{tier.label}</span>
        <span className="text-[11.5px] font-semibold text-charcoal-2">Screen · {grade.overall}/5</span>
        <span className="text-[11px] text-muted-2">pre-interview read</span>
      </div>
      {grade.summary && <p className="text-[13px] text-charcoal-2 mb-2.5">{grade.summary}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {axes.map(({ key, g }) => (
          <div key={key} className="rounded-lg bg-white border border-line px-3 py-2">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[12px] font-semibold text-ink">{AXIS_LABEL[key]}</span>
              <span className="text-[12px] font-semibold text-muted tabular-nums">{g.score}/5</span>
            </div>
            <div className="flex gap-1 mb-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`flex-1 h-1 rounded-full ${i < g.score ? "bg-brick" : "bg-line"}`} />
              ))}
            </div>
            {g.rationale && <p className="text-[12px] text-muted leading-snug">{g.rationale}</p>}
          </div>
        ))}
      </div>
      {answers.length > 0 && (
        <>
          <button onClick={() => setShowAnswers((v) => !v)} className="mt-2.5 text-[12px] font-semibold text-brick hover:text-brick-dark">
            {showAnswers ? "Hide their answers" : `Read their ${answers.length} answer${answers.length === 1 ? "" : "s"}`}
          </button>
          {showAnswers && (
            <div className="mt-2 flex flex-col gap-2">
              {answers.map((a) => (
                <div key={a.id} className="text-[12.5px]">
                  <div className="font-semibold text-charcoal-2">{a.prompt}</div>
                  <div className="text-muted whitespace-pre-wrap">{a.value}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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

// Applicants are grouped best→worst by their AI screening tier so the strong
// ones surface at the top and the weak pile can be folded away. Ungraded
// applicants (no screening questions answered) get a neutral "Not yet screened"
// group. "pass" collapses by default — that's the scroll-killer.
type GroupKey = ScreeningTier | "unscored";
const GROUP_ORDER: GroupKey[] = ["strong", "worth_a_look", "unscored", "pass"];
const GROUP_META: Record<GroupKey, { label: string; fg: string; bg: string; collapsedByDefault: boolean }> = {
  strong: { ...TIER_META.strong, collapsedByDefault: false },
  worth_a_look: { ...TIER_META.worth_a_look, collapsedByDefault: false },
  unscored: { label: "Not yet screened", fg: "text-charcoal-2", bg: "bg-[#F1F1F1]", collapsedByDefault: false },
  pass: { ...TIER_META.pass, collapsedByDefault: true },
};
const groupOf = (a: Applicant): GroupKey => a.screeningGrade?.tier ?? "unscored";
// Sort within a group: highest screening score first, then most recent.
function byScoreThenDate(a: Applicant, b: Applicant): number {
  const sa = a.screeningGrade?.overall ?? -1;
  const sb = b.screeningGrade?.overall ?? -1;
  if (sb !== sa) return sb - sa;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function ApplicantsPanel({ applicants, applyUrl, applySlug, applicationsCc, logoUrl, formConfig }: { applicants: Applicant[]; applyUrl: string | null; applySlug: string | null; applicationsCc: string; logoUrl: string | null; formConfig: ApplicationFormConfig }) {
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [cc, setCc] = useState(applicationsCc);
  const [ccMsg, setCcMsg] = useState<string | null>(null);
  const [ccPending, startCc] = useTransition();
  const [logo, setLogo] = useState(logoUrl);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoPending, startLogo] = useTransition();
  const [slug, setSlug] = useState(applySlug ?? "");
  const [slugDraft, setSlugDraft] = useState(applySlug ?? "");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState<string | null>(null);
  const [slugPending, startSlug] = useTransition();
  const [showForwarding, setShowForwarding] = useState(false);
  // Which tier groups are collapsed (default: the "Probably pass" pile).
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(
    () => new Set(GROUP_ORDER.filter((g) => GROUP_META[g].collapsedByDefault)),
  );
  const toggleGroup = (g: GroupKey) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  // The link prefix (https://…/apply/) so we can show/edit just the slug part.
  const applyBase = applyUrl && slug ? applyUrl.slice(0, applyUrl.length - slug.length) : "";
  const liveUrl = applyBase ? `${applyBase}${slug}` : applyUrl;

  function saveSlug() {
    setSlugMsg(null);
    startSlug(async () => {
      const res = await updateApplySlug(slugDraft);
      if (res.error) setSlugMsg(res.error);
      else { setSlug(res.slug ?? slugDraft); setEditingSlug(false); setSlugMsg("Saved. Your old link no longer works."); setTimeout(() => setSlugMsg(null), 4000); }
    });
  }

  const embedCode = liveUrl
    ? `<iframe id="wingman-apply" src="${liveUrl}?embed=1" title="Job application" scrolling="no" style="width:100%;max-width:640px;border:0;display:block;margin:0 auto;min-height:760px"></iframe>
<script>window.addEventListener("message",function(e){var h=e&&e.data&&e.data.wingmanApplyHeight;if(typeof h==="number"&&h>0&&h<20000){var f=document.getElementById("wingman-apply");if(f){f.style.minHeight="0";f.style.height=h+"px";}}});</script>`
    : "";

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
  // Only group by tier when at least one applicant has actually been screened;
  // otherwise a single flat (score-then-date) list reads cleaner.
  const anyGraded = applicants.some((a) => a.screeningGrade);

  function copyLink() {
    if (!liveUrl) return;
    navigator.clipboard.writeText(liveUrl).then(() => {
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
            <button onClick={() => setShowBuilder((v) => !v)} className={`inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-3.5 py-2 border transition-colors ${showBuilder ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-charcoal-2 hover:border-brick hover:text-brick"}`}>
              <SlidersHorizontal size={14} /> Customize form
            </button>
          </div>
        )}
      </div>

      {showBuilder && applyUrl && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-line">
            <div>
              <div className="text-[15px] font-semibold text-ink">Customize your application form</div>
              <p className="text-[12.5px] text-muted-2 mt-0.5">Choose which fields to ask, rename them, and add your own questions. Changes go live on your link and embed.</p>
            </div>
            <a href={`${applyUrl}?preview=1`} target="_blank" rel="noopener" className="text-[12.5px] font-semibold text-brick hover:text-brick-dark shrink-0">Preview ↗</a>
          </div>
          <ApplicationFormEditor initial={formConfig} />
        </div>
      )}

      {showEmbed && applyUrl && (
        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-ink">Embed on your website</label>
            <button onClick={copyEmbed} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick hover:text-brick-dark">
              {embedCopied ? <Check size={13} className="text-[#15803d]" /> : <Code2 size={13} />} {embedCopied ? "Copied" : "Copy code"}
            </button>
          </div>
          <textarea readOnly value={embedCode} onFocus={(e) => e.currentTarget.select()} rows={5} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-mono text-charcoal-2 outline-none" />
          <p className="text-[12px] text-muted-2 mt-1.5">Paste this into an HTML / custom-code block on your site (in GoHighLevel, use a &ldquo;Custom HTML&rdquo; element). The form centers, resizes to fit with no scrollbar, and shows no Wingman branding.</p>
        </div>
      )}

      {applyUrl && (
        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm mb-4">
          <div className="text-[13px] font-semibold text-ink mb-1">Your application link</div>
          {!editingSlug ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] text-charcoal-2 font-mono break-all">{(liveUrl || "").replace(/^https?:\/\//, "")}</span>
              <button onClick={() => { setSlugDraft(slug); setEditingSlug(true); setSlugMsg(null); }} className="text-[12.5px] font-semibold text-brick hover:text-brick-dark">Edit</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[13px] text-muted-2 font-mono">{applyBase.replace(/^https?:\/\//, "")}</span>
                <input
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                  placeholder="your-restaurant"
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13.5px] font-mono text-ink outline-none focus:border-brick min-w-[180px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveSlug} disabled={slugPending || !slugDraft.trim()} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark disabled:opacity-50">
                  {slugPending ? "Saving…" : "Save link"}
                </button>
                <button onClick={() => { setEditingSlug(false); setSlugMsg(null); }} className="text-[12.5px] font-semibold text-muted-2 hover:text-ink">Cancel</button>
              </div>
              <p className="text-[12px] text-muted-2">Lowercase letters, numbers, and hyphens. Changing it retires your old link.</p>
            </div>
          )}
          {slugMsg && <p className="text-[12px] text-olive font-semibold mt-1.5">{slugMsg}</p>}

          <button onClick={() => setShowForwarding((v) => !v)} className="mt-3 text-[12.5px] font-semibold text-charcoal-2 hover:text-brick">
            {showForwarding ? "Hide" : "Use your own domain (e.g. careers.yourrestaurant.com) →"}
          </button>
          {showForwarding && (
            <div className="mt-2 rounded-xl bg-paper border border-line p-3 text-[12.5px] text-muted leading-relaxed">
              <p className="mb-1.5">Want applicants to visit a link on <strong>your</strong> domain? Point a subdomain at this link with a free URL forward at your domain registrar (GoDaddy, Namecheap, Google Domains, etc.):</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>In your registrar, add a <strong>subdomain</strong> like <span className="font-mono">careers</span> or <span className="font-mono">jobs</span>.</li>
                <li>Set up a <strong>URL forward (redirect)</strong> from that subdomain to your link above.</li>
                <li>Share <span className="font-mono">careers.yourrestaurant.com</span> — it lands on your Wingman form.</li>
              </ol>
              <p className="mt-1.5 text-muted-2">Prefer the form embedded directly on your own website instead? Use the <strong>Embed</strong> option above.</p>
            </div>
          )}
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
      ) : anyGraded ? (
        <div className="flex flex-col gap-5">
          {GROUP_ORDER.map((g) => {
            const members = shown.filter((a) => groupOf(a) === g).sort(byScoreThenDate);
            if (members.length === 0) return null;
            const meta = GROUP_META[g];
            const isCollapsed = collapsed.has(g);
            return (
              <section key={g}>
                <button onClick={() => toggleGroup(g)} className="w-full flex items-center gap-2 mb-2.5 text-left">
                  {isCollapsed ? <ChevronRight size={16} className="text-muted-2 shrink-0" /> : <ChevronDown size={16} className="text-muted-2 shrink-0" />}
                  <span className={`text-[11.5px] font-bold px-2.5 py-0.5 rounded-full ${meta.bg} ${meta.fg}`}>{meta.label}</span>
                  <span className="text-[12.5px] font-semibold text-muted tabular-nums">· {members.length}</span>
                  {isCollapsed && <span className="text-[12px] text-muted-2">— tap to show</span>}
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-2">
                    {members.map((a) => <ApplicantCard key={a.id} a={a} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...shown].sort(byScoreThenDate).map((a) => <ApplicantCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function ApplicantCard({ a }: { a: Applicant }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(a.status);
  const [when, setWhen] = useState(toLocalInput(a.interviewAt));
  const [details, setDetails] = useState(a.interviewDetails);
  const [scheduling, setScheduling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = toneOf(status);
  const grade = a.screeningGrade;
  const tierMeta = grade ? TIER_META[grade.tier] : null;

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
    <div className="bg-white border border-line rounded-2xl shadow-sm">
      {/* Compact header — always visible, click to expand the full application. */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 flex items-center gap-3 text-left" aria-expanded={open}>
          {open ? <ChevronDown size={16} className="text-muted-2 shrink-0" /> : <ChevronRight size={16} className="text-muted-2 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14.5px] font-semibold text-ink truncate">{a.name}</span>
              {tierMeta && grade && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tierMeta.bg} ${tierMeta.fg}`}>{grade.overall}/5</span>
              )}
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone.cls}`}>{tone.label}</span>
            </div>
            <div className="text-[12.5px] text-muted mt-0.5 truncate">
              {a.department || "Any role"}{a.locationName ? ` · ${a.locationName}` : ""} · applied {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
        </button>
        <button onClick={remove} disabled={pending} className="text-muted-2 hover:text-danger disabled:opacity-50 shrink-0" title="Remove"><Trash2 size={15} /></button>
      </div>

      {!open ? null : (
      <div className="px-5 pb-5 -mt-1">
      {(a.email || a.phone) && <div className="text-[13px] text-charcoal-2">{[a.email, a.phone].filter(Boolean).join(" · ")}</div>}
      {a.availability && <div className="text-[13px] text-muted mt-1"><span className="font-semibold text-charcoal-2">Availability:</span> {a.availability}</div>}
      {a.preferredVisitAt && <div className="text-[13px] text-muted mt-1"><span className="font-semibold text-charcoal-2">Wants to come in:</span> {new Date(a.preferredVisitAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
      {a.message && <p className="text-[13px] text-muted mt-1 whitespace-pre-wrap">{a.message}</p>}
      {a.customAnswers.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {a.customAnswers.filter((c) => String(c.value ?? "").trim()).map((c) => (
            <div key={c.id} className="text-[13px] text-muted"><span className="font-semibold text-charcoal-2">{c.label}:</span> {c.value}</div>
          ))}
        </div>
      )}

      {a.screeningGrade ? (
        <ScreeningGradeBlock grade={a.screeningGrade} answers={a.screeningAnswers} />
      ) : a.screeningAnswers.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2">Screening answers</div>
          {a.screeningAnswers.map((s) => (
            <div key={s.id} className="text-[12.5px]">
              <div className="font-semibold text-charcoal-2">{s.prompt}</div>
              <div className="text-muted whitespace-pre-wrap">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

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
      )}
    </div>
  );
}
