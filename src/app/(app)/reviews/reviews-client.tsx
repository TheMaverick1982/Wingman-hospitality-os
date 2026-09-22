"use client";

import { useState, useTransition } from "react";
import { Copy, Check, QrCode, Star, MessageSquare, Sparkles, Heart } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { avgRating, RATING_LABEL } from "@/lib/guest-survey";
import { generateReviewSummary, setSurveyAskServer, setReviewDigestFrequency, setReviewDigestCc, recognizeFromReview, setExecRecapFrequency, setExecRecapEmails, setExecRecapIncludeActions, sendExecRecapTestNow, type ReviewDigestFrequency, type ExecRecapFrequency } from "./actions";

// Render **bold** markers inline without dangerouslySetInnerHTML.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? <strong key={i} className="text-ink">{seg.slice(2, -2)}</strong> : <span key={i}>{seg}</span>
  );
}

export type SurveyLinkRow = { locationId: string; locationName: string; code: string; scanCount: number };
export type ReviewRow = {
  id: string;
  locationName: string;
  serverFirstName: string;
  hasServer: boolean;
  recognized: boolean;
  ratings: Record<string, number>;
  comment: string;
  createdAt: string;
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rounded ? "text-gold fill-gold" : "text-line"} strokeWidth={2} />
      ))}
    </span>
  );
}

export function ReviewsClient({
  siteUrl,
  links,
  responses,
  canManage,
  isSuperAdmin = false,
  askServer,
  hasGoogleReviews,
  digestFrequency = "off",
  digestCc = "",
  execFrequency = "off",
  execEmails = "",
  execIncludeActions = true,
  scopeLocationId,
  googleSlot,
}: {
  siteUrl: string;
  links: SurveyLinkRow[];
  responses: ReviewRow[];
  canManage: boolean;
  isSuperAdmin?: boolean;
  askServer: boolean;
  hasGoogleReviews?: boolean;
  digestFrequency?: ReviewDigestFrequency;
  digestCc?: string;
  execFrequency?: ExecRecapFrequency;
  execEmails?: string;
  execIncludeActions?: boolean;
  scopeLocationId: string | null;
  googleSlot?: React.ReactNode;
}) {
  const hasGoogle = Boolean(googleSlot);
  const [tab, setTab] = useState<"survey" | "google">("survey");
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarizing, startSummary] = useTransition();
  const [ask, setAsk] = useState(askServer);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [savingAsk, startAsk] = useTransition();
  const [digest, setDigest] = useState<ReviewDigestFrequency>(digestFrequency);
  const [savingDigest, startDigest] = useTransition();
  const [cc, setCc] = useState(digestCc);
  const [ccSaved, setCcSaved] = useState(false);
  const [savingCc, startCc] = useTransition();
  // Ownership recap (super-admin only): company-wide, to specific owner emails.
  const [execFreq, setExecFreq] = useState<ExecRecapFrequency>(execFrequency);
  const [savingExecFreq, startExecFreq] = useTransition();
  const [execMails, setExecMails] = useState(execEmails);
  const [execMailsSaved, setExecMailsSaved] = useState(false);
  const [savingExecMails, startExecMails] = useTransition();
  const [execActions, setExecActions] = useState(execIncludeActions);
  const [savingExecActions, startExecActions] = useTransition();

  function chooseExecFreq(next: ExecRecapFrequency) {
    const prev = execFreq;
    setExecFreq(next);
    startExecFreq(async () => {
      const res = await setExecRecapFrequency(next);
      if (res.error) setExecFreq(prev);
    });
  }
  function saveExecMails() {
    setExecMailsSaved(false);
    startExecMails(async () => {
      const res = await setExecRecapEmails(execMails);
      if (!res.error) { setExecMailsSaved(true); setTimeout(() => setExecMailsSaved(false), 2500); }
    });
  }
  function toggleExecActions(next: boolean) {
    setExecActions(next);
    startExecActions(async () => {
      const res = await setExecRecapIncludeActions(next);
      if (res.error) setExecActions(!next);
    });
  }
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [sendingTest, startTest] = useTransition();
  function sendExecTest() {
    setTestMsg(null);
    setTestErr(null);
    startTest(async () => {
      const res = await sendExecRecapTestNow();
      if (res.error) setTestErr(res.error);
      else setTestMsg(`Sent to ${res.sentTo}`);
    });
  }
  // Locally track which reviews have been turned into a Wins-feed shout-out, so
  // the button flips to "Recognized" the moment it's tapped.
  const [recognized, setRecognized] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(responses.filter((r) => r.recognized).map((r) => [r.id, true])),
  );
  const [recognizing, setRecognizing] = useState<string | null>(null);
  const [, startRecognize] = useTransition();

  function recognize(id: string) {
    setRecognizing(id);
    startRecognize(async () => {
      const res = await recognizeFromReview(id);
      setRecognizing(null);
      if (!res.error) setRecognized((m) => ({ ...m, [id]: true }));
    });
  }

  function chooseDigest(next: ReviewDigestFrequency) {
    const prev = digest;
    setDigest(next);
    startDigest(async () => {
      const res = await setReviewDigestFrequency(next);
      if (res.error) setDigest(prev);
    });
  }

  function saveCc() {
    setCcSaved(false);
    startCc(async () => {
      const res = await setReviewDigestCc(cc);
      if (!res.error) { setCcSaved(true); setTimeout(() => setCcSaved(false), 2500); }
    });
  }

  function toggleAsk(next: boolean) {
    setAsk(next);
    setAskErr(null);
    startAsk(async () => {
      const res = await setSurveyAskServer(next);
      if (res.error) { setAsk(!next); setAskErr(res.error); }
    });
  }

  function summarize() {
    setSummaryError(null);
    startSummary(async () => {
      const res = await generateReviewSummary(scopeLocationId);
      if (res.error) setSummaryError(res.error);
      else setSummary(res.summary ?? "");
    });
  }

  const shortLink = (code: string) => `${siteUrl}/s/${code}`;
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  }

  const rated = responses.filter((r) => avgRating(r.ratings) > 0);
  const overallAvg = rated.length ? rated.reduce((a, r) => a + avgRating(r.ratings), 0) / rated.length : 0;
  const positives = rated.filter((r) => avgRating(r.ratings) >= 4.5).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Guest Reviews</h1>
        <p className="text-base text-muted max-w-xl">
          Feedback guests leave from your survey QR / link. It lives here, separate from Guest Bounce Back — a response
          never adds a guest or counts as a visit.
        </p>
      </div>

      {/* Unified AI readout — spans BOTH survey feedback and Google reviews, at the
          top so it's the first thing you see regardless of which tab is active. */}
      {canManage && (responses.length > 0 || hasGoogleReviews) && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink">What your guests are telling you</div>
            <button
              type="button"
              onClick={summarize}
              disabled={summarizing}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50"
            >
              <Sparkles size={13} /> {summarizing ? "Reading reviews…" : summary ? "Refresh" : "Summarize with AI"}
            </button>
          </div>
          {!summary && !summaryError && (
            <p className="text-[13px] text-muted">
              One AI read across your survey feedback{hasGoogleReviews ? " and your Google reviews" : ""} — what guests love, where to improve, and the one fix to make this week.
            </p>
          )}
          {summaryError && <p className="text-sm text-danger mt-1">{summaryError}</p>}
          {summary && (
            <div className="text-[14px] text-charcoal-2 leading-relaxed mt-2 flex flex-col gap-1">
              {summary.split("\n").filter((l) => l.trim()).map((line, i) => (
                <div key={i}>{renderInline(line)}</div>
              ))}
            </div>
          )}

          {/* Auto-send this report to each location's managers + the owner. */}
          <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink">Email this report automatically</div>
              <p className="text-[12.5px] text-muted-2 mt-0.5">Sends each location&rsquo;s report to its managers and you {digest === "off" ? "" : digest === "weekly" ? "every Monday" : "on the 1st"}.</p>
            </div>
            <div className="flex gap-1.5 bg-panel border border-line rounded-full p-1 shrink-0">
              {([
                { id: "off" as const, label: "Off" },
                { id: "weekly" as const, label: "Weekly" },
                { id: "monthly" as const, label: "Monthly" },
              ]).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => chooseDigest(o.id)}
                  disabled={savingDigest}
                  className={`text-[12.5px] font-semibold rounded-full px-3 py-1.5 transition-colors disabled:opacity-60 ${
                    digest === o.id ? "bg-brick text-white" : "text-charcoal-2 hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {digest !== "off" && (
            <div className="mt-3">
              <label className="block text-[12.5px] font-semibold text-ink mb-1">Also send to (master copy)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  onBlur={saveCc}
                  placeholder="owner@restaurant.com, regional@…"
                  className="flex-1 min-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brick"
                />
                <button type="button" onClick={saveCc} disabled={savingCc} className="text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-2 hover:border-brick hover:text-brick disabled:opacity-50">
                  {savingCc ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="text-[12px] text-muted-2 mt-1.5">Each location&rsquo;s report always goes to its managers — these addresses get a copy of every location&rsquo;s report too. Separate several with commas. {ccSaved && <span className="text-olive font-semibold">Saved</span>}</p>
            </div>
          )}
        </div>
      )}

      {/* Ownership recap — company-wide (all locations) exec view, to specific
          ownership addresses. Owner-only: only a Super Admin sees or edits this. */}
      {isSuperAdmin && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Ownership recap</div>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brick bg-brick-tint rounded-full px-2 py-0.5">Owner only</span>
            </div>
            <div className="flex gap-1.5 bg-panel border border-line rounded-full p-1 shrink-0">
              {([
                { id: "off" as const, label: "Off" },
                { id: "daily" as const, label: "Daily" },
                { id: "weekly" as const, label: "Weekly" },
              ]).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => chooseExecFreq(o.id)}
                  disabled={savingExecFreq}
                  className={`text-[12.5px] font-semibold rounded-full px-3 py-1.5 transition-colors disabled:opacity-60 ${
                    execFreq === o.id ? "bg-brick text-white" : "text-charcoal-2 hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-muted">
            A single company-wide read across <span className="font-semibold text-charcoal-2">all locations</span>, emailed {execFreq === "off" ? "to ownership" : execFreq === "daily" ? "every morning" : "every Monday"} — what guests love and where to improve, with a few supporting quotes. For ownership; only you can set the recipients.
          </p>

          {execFreq !== "off" && (
            <>
              <div className="mt-4">
                <label className="block text-[12.5px] font-semibold text-ink mb-1">Send to</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={execMails}
                    onChange={(e) => setExecMails(e.target.value)}
                    onBlur={saveExecMails}
                    placeholder="owner@company.com, partner@company.com"
                    className="flex-1 min-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brick"
                  />
                  <button type="button" onClick={saveExecMails} disabled={savingExecMails} className="text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-2 hover:border-brick hover:text-brick disabled:opacity-50">
                    {savingExecMails ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-[12px] text-muted-2 mt-1.5">Only these addresses get the ownership recap. Separate several with commas. {execMailsSaved && <span className="text-olive font-semibold">Saved</span>}</p>
              </div>

              <label className="mt-4 flex items-start justify-between gap-4 cursor-pointer">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">Include the &ldquo;This week&rdquo; action</div>
                  <p className="text-[12.5px] text-muted-2 mt-0.5">Adds the single highest-leverage fix at the end. Turn off for just &ldquo;what guests love&rdquo; and &ldquo;where to improve.&rdquo;</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={execActions}
                  disabled={savingExecActions}
                  onClick={() => toggleExecActions(!execActions)}
                  className={`relative shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${execActions ? "bg-brick" : "bg-line-strong"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${execActions ? "translate-x-5" : ""}`} />
                </button>
              </label>
            </>
          )}

          <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendExecTest}
              disabled={sendingTest}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3.5 py-2 hover:bg-brick-tint disabled:opacity-50"
            >
              {sendingTest ? "Sending…" : "Send a test now"}
            </button>
            <span className="text-[12px] text-muted-2">
              {testMsg ? <span className="text-olive font-semibold">{testMsg}</span> : testErr ? <span className="text-danger font-semibold">{testErr}</span> : "Emails the recap to your ownership addresses (or to you if none saved yet)."}
            </span>
          </div>
        </div>
      )}

      {hasGoogle && (
        <div className="flex flex-col gap-2 sm:self-start">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-2">Showing — tap to switch</span>
          <div className="flex gap-2 w-full sm:w-auto">
            {([
              { id: "survey" as const, label: "Survey feedback", Icon: MessageSquare },
              { id: "google" as const, label: "Google reviews", Icon: Star },
            ]).map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-[13.5px] font-semibold rounded-full px-4 py-2.5 border transition-colors ${
                    on
                      ? "bg-brick text-white border-brick shadow-sm"
                      : "bg-white text-charcoal-2 border-line-strong hover:border-brick hover:text-brick"
                  }`}
                >
                  <t.Icon size={14} className={on ? "text-white" : "text-muted-2"} strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasGoogle && <div hidden={tab !== "google"}>{googleSlot}</div>}

      <div hidden={hasGoogle && tab !== "survey"} className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Responses</div>
          <div className="text-[26px] font-bold text-ink tabular-nums">{responses.length}</div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Avg rating</div>
          <div className="text-[26px] font-bold text-ink tabular-nums flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span>{overallAvg ? overallAvg.toFixed(1) : "—"}</span>
            {overallAvg > 0 && <Stars value={overallAvg} />}
          </div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Rave reviews</div>
          <div className="text-[26px] font-bold text-olive tabular-nums">{positives}</div>
        </div>
      </div>

      {/* Share links */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink mb-1">Share your survey</div>
        <p className="text-[13px] text-muted mb-4">
          Put the QR on a table tent, receipt, or window — or drop the link in a text/email. Each location has its own.
        </p>
        <div className="flex flex-col gap-2.5">
          {links.map((l) => (
            <div key={l.locationId} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-line p-3.5">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-ink">{l.locationName}</div>
                <div className="text-[12.5px] text-muted-2 font-mono break-all">{shortLink(l.code)}</div>
                <div className="text-[12px] text-muted-2 tabular-nums mt-0.5">{l.scanCount} scan{l.scanCount === 1 ? "" : "s"}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => copy(shortLink(l.code), `l:${l.code}`)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                  {copied === `l:${l.code}` ? <Check size={12} /> : <Copy size={12} />} {copied === `l:${l.code}` ? "Copied" : "Link"}
                </button>
                <button type="button" aria-label="QR code" onClick={() => setQr(l.code)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                  <QrCode size={12} /> QR
                </button>
              </div>
            </div>
          ))}
          {links.length === 0 && <p className="text-sm text-muted py-2">No locations yet.</p>}
        </div>

        {canManage && (
          <div className="mt-4 pt-4 border-t border-line">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">Ask guests who took care of them</div>
                <p className="text-[12.5px] text-muted-2 mt-0.5">Shows a &ldquo;Who took care of you?&rdquo; picker on the survey so feedback can be credited to a server. Turn off for counter-service or if you&rsquo;d rather not tie reviews to a person.</p>
                {askErr && <p className="text-[12px] text-danger mt-1">{askErr}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ask}
                disabled={savingAsk}
                onClick={() => toggleAsk(!ask)}
                className={`relative shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${ask ? "bg-brick" : "bg-line-strong"}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ask ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <p className="text-[12px] text-muted-2 mt-2">Want to hide just one person instead? Open their profile in Staff and turn off &ldquo;Show on the guest survey.&rdquo;</p>
          </div>
        )}
      </div>

      {/* Archive */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2 mb-3">Recent feedback</div>
        {responses.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center">
            <MessageSquare className="mx-auto text-muted-2 mb-2" size={24} />
            <p className="text-[15px] text-muted">No responses yet. Share your survey QR / link and they&rsquo;ll show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {responses.map((r) => {
              const avg = avgRating(r.ratings);
              return (
                <div key={r.id} className="bg-white border border-line rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {avg > 0 && <Stars value={avg} />}
                      {r.locationName && <span className="text-[12.5px] text-muted-2">{r.locationName}</span>}
                      {r.serverFirstName && (
                        <span className="text-[11.5px] font-semibold text-olive bg-olive-tint rounded-full px-2 py-0.5">Served by {r.serverFirstName}</span>
                      )}
                    </div>
                    <span className="text-[12px] text-muted-2">{when(r.createdAt)}</span>
                  </div>
                  {Object.keys(r.ratings).length > 0 && (
                    <div className="text-[12px] text-muted-2 mt-1.5 flex flex-wrap gap-x-3">
                      {Object.entries(r.ratings).map(([k, v]) => (
                        <span key={k}>{(RATING_LABEL[k] ?? k).replace(/\?$/, "")}: <span className="font-semibold text-ink">{v}/5</span></span>
                      ))}
                    </div>
                  )}
                  {r.comment && <p className="text-[14px] text-ink leading-relaxed mt-2 whitespace-pre-wrap">{r.comment}</p>}
                  {canManage && r.hasServer && r.serverFirstName && (
                    <div className="mt-2.5 pt-2.5 border-t border-line/70">
                      {recognized[r.id] ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-olive">
                          <Check size={13} /> Recognized on the Wins feed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => recognize(r.id)}
                          disabled={recognizing === r.id}
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50"
                        >
                          <Heart size={13} /> {recognizing === r.id ? "Posting…" : `Recognize ${r.serverFirstName}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {qr && (
        <Modal title="Survey QR code" sub="Scan to open the guest survey — print it on a table tent, receipt, or window cling." onClose={() => setQr(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/s/${qr}/qr`} alt="Survey QR code" width={240} height={240} className="rounded-xl border border-line" />
            <div className="text-[12px] text-muted-2 font-mono break-all text-center">{shortLink(qr)}</div>
            <a href={`/s/${qr}/qr`} download={`survey-${qr}.svg`} className="text-[13px] font-semibold text-brick hover:opacity-70">
              Download QR (SVG)
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
