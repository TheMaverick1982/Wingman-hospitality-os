"use client";

import { useEffect, useState, useTransition } from "react";
import { Mail, Phone, MapPin, Paperclip, Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TIER_META } from "@/lib/screening";
import { getApplicantDetail, type ApplicantDetail } from "./ask-applicants-actions";
import { getResumeUrl } from "./applicant-actions";

const sectionLabel = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1.5";

export function ApplicantDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [resumePending, startResume] = useTransition();
  const [resumeErr, setResumeErr] = useState<string | null>(null);

  useEffect(() => {
    startLoad(async () => {
      const res = await getApplicantDetail(id);
      if (res.error) setErr(res.error);
      else setDetail(res.detail);
    });
  }, [id]);

  function openResume() {
    setResumeErr(null);
    startResume(async () => {
      const res = await getResumeUrl(id);
      if (res.url) window.open(res.url, "_blank", "noopener");
      else setResumeErr(res.error ?? "Couldn't open that resume.");
    });
  }

  const grade = detail?.screeningGrade ?? null;
  const tier = grade ? TIER_META[grade.tier] : null;

  return (
    <Modal
      title={detail?.name ?? "Applicant"}
      sub={detail ? [detail.role, detail.locationName].filter(Boolean).join(" · ") || undefined : undefined}
      onClose={onClose}
      wide
    >
      {loading && !detail ? (
        <p className="text-[13px] text-muted py-4">Loading…</p>
      ) : err ? (
        <p className="text-[13px] text-danger py-4">{err}</p>
      ) : detail ? (
        <div className="flex flex-col gap-4">
          {/* Top: tier + resume */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {tier && grade && <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${tier.bg} ${tier.fg}`}>{tier.label} · {grade.overall}/5</span>}
              <span className="text-[12px] text-muted-2">Applied {new Date(detail.appliedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{detail.source ? ` · via ${detail.source}` : ""}</span>
            </div>
            {detail.hasResume && (
              <div className="flex flex-col items-end">
                <button
                  onClick={openResume}
                  disabled={resumePending}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50 transition-colors"
                >
                  <Download size={14} /> {resumePending ? "Opening…" : "Download resume"}
                </button>
                {resumeErr && <span className="text-[11.5px] text-danger mt-1">{resumeErr}</span>}
              </div>
            )}
          </div>

          {/* Contact */}
          {(detail.email || detail.phone) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px]">
              {detail.email && <a href={`mailto:${detail.email}`} className="inline-flex items-center gap-1.5 text-brick font-medium"><Mail size={14} />{detail.email}</a>}
              {detail.phone && <a href={`tel:${detail.phone}`} className="inline-flex items-center gap-1.5 text-charcoal-2"><Phone size={14} />{detail.phone}</a>}
              {detail.locationName && <span className="inline-flex items-center gap-1.5 text-muted-2"><MapPin size={14} />{detail.locationName}</span>}
            </div>
          )}

          {detail.availability && (
            <div>
              <div className={sectionLabel}>Availability</div>
              <p className="text-[13.5px] text-charcoal-2 whitespace-pre-wrap">{detail.availability}</p>
            </div>
          )}

          {detail.message && (
            <div>
              <div className={sectionLabel}>Their message</div>
              <p className="text-[13.5px] text-charcoal-2 whitespace-pre-wrap">{detail.message}</p>
            </div>
          )}

          {detail.customAnswers.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className={sectionLabel}>Application answers</div>
              {detail.customAnswers.map((c, i) => (
                <div key={i} className="text-[13.5px]">
                  <div className="font-semibold text-charcoal-2">{c.label}</div>
                  <div className="text-muted whitespace-pre-wrap">{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {grade && (
            <div className="rounded-xl border border-line bg-paper/60 p-3.5">
              <div className={sectionLabel}>AI screening read</div>
              <p className="text-[13.5px] text-charcoal-2 mb-2">{grade.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">Guest experience · {grade.hospitality.score}/5</div>
                  <div className="text-[12.5px] text-muted">{grade.hospitality.rationale}</div>
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">Follows instructions · {grade.followsInstructions.score}/5</div>
                  <div className="text-[12.5px] text-muted">{grade.followsInstructions.rationale}</div>
                </div>
              </div>
            </div>
          )}

          {detail.screeningAnswers.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel}>Screening answers</div>
              {detail.screeningAnswers.map((a, i) => (
                <div key={i} className="text-[13.5px]">
                  <div className="font-semibold text-charcoal-2">{a.prompt}</div>
                  <div className="text-muted whitespace-pre-wrap">{a.value}</div>
                </div>
              ))}
            </div>
          )}

          {!detail.hasResume && (
            <p className="text-[12.5px] text-muted-2 inline-flex items-center gap-1.5"><Paperclip size={13} /> No resume on file.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
