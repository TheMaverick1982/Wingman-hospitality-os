"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send, Mail, Phone, MapPin } from "lucide-react";
import { TIER_META } from "@/lib/screening";
import { askApplicants, type ApplicantMatch } from "./ask-applicants-actions";
import { ApplicantDetailModal } from "./applicant-detail-modal";

const EXAMPLES = [
  "Who has real restaurant experience and is available weekends?",
  "Top 5 to interview first, and why.",
  "What do my strongest applicants have in common?",
  "Who applied for a server role in the last two weeks?",
];

export function AskApplicantsPanel() {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState<string | null>(null);
  const [matches, setMatches] = useState<ApplicantMatch[]>([]);
  const [analyzed, setAnalyzed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [asked, setAsked] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  function ask(question: string) {
    const question2 = question.trim();
    if (!question2 || pending) return;
    setErr(null);
    setAsked(question2);
    start(async () => {
      const res = await askApplicants(question2);
      if (res.error) { setErr(res.error); setAnswer(null); setMatches([]); return; }
      setAnswer(res.answer);
      setMatches(res.matches);
      setAnalyzed(res.analyzed);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Ask anything about the people who&rsquo;ve applied — Wingman reads their form answers, screening answers, AI grades, and resume text
        (across your active applicants) and answers with a shortlist you can act on. It only uses what applicants actually submitted.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(q); }}
          placeholder="e.g. Who has bartending experience and can work nights?"
          className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brick"
        />
        <button
          onClick={() => ask(q)}
          disabled={pending || !q.trim()}
          className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50 transition-colors"
        >
          <Send size={15} /> {pending ? "Thinking…" : "Ask"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setQ(ex); ask(ex); }}
            disabled={pending}
            className="text-[12.5px] text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick disabled:opacity-50 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {err && <p className="text-[13px] text-danger">{err}</p>}

      {(pending || answer) && (
        <div className="rounded-2xl border border-line bg-paper/60 p-4 sm:p-5">
          {pending ? (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Sparkles size={15} className="text-brick" /> Reading your applicants…
            </div>
          ) : (
            <>
              {asked && <div className="text-[12.5px] font-semibold text-charcoal-2 mb-2">&ldquo;{asked}&rdquo;</div>}
              <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">{answer}</p>
              {analyzed > 0 && <p className="text-[11.5px] text-muted-2 mt-2">Based on {analyzed} active applicant{analyzed === 1 ? "" : "s"}.</p>}

              {matches.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2">Matching applicants</div>
                  {matches.map((m) => {
                    const tier = m.tier ? TIER_META[m.tier as keyof typeof TIER_META] : null;
                    return (
                      <div key={m.id} className="bg-white border border-line rounded-xl p-3 hover:border-brick/40 transition-colors">
                        <button type="button" onClick={() => setOpenId(m.id)} className="w-full text-left group" title="View full details">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-ink group-hover:text-brick transition-colors">{m.name}</span>
                            {tier && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.fg}`}>{tier.label}{m.overall ? ` · ${m.overall}/5` : ""}</span>}
                          </div>
                          <div className="text-[12.5px] text-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{m.role}</span>
                            {m.locationName && <span className="inline-flex items-center gap-1"><MapPin size={12} />{m.locationName}</span>}
                            <span>applied {new Date(m.appliedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <span className="text-brick font-medium">View details →</span>
                          </div>
                        </button>
                        {(m.email || m.phone) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12.5px]">
                            {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-brick font-medium"><Mail size={12} />{m.email}</a>}
                            {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 text-charcoal-2"><Phone size={12} />{m.phone}</a>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {openId && <ApplicantDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
