"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, Paperclip, Undo2, UserPlus } from "lucide-react";
import type { Applicant } from "./applicants-panel";
import { unconfirmInterview, getResumeUrl } from "./applicant-actions";
import { formatInZone } from "@/lib/timezone";
import { useLocationParam } from "@/components/app-shell/use-location-param";

// Confirmed interviews — applicants who've moved into the candidates area with a
// scheduled interview, waiting to be scored.
export function InterviewsPanel({ interviews }: { interviews: Applicant[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck size={18} className="text-brick" />
        <h3 className="font-display text-lg font-semibold text-ink">Interviews scheduled</h3>
        <span className="text-[13px] text-muted">· {interviews.length}</span>
      </div>
      <div className="flex flex-col gap-3">
        {interviews.map((a) => <InterviewCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}

function InterviewCard({ a }: { a: Applicant }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Carry the currently-selected location through so scoring an interview
  // doesn't snap the page (and the top switcher) back to "All locations". Reads
  // without useSearchParams so this component can't suspend the Hiring page.
  const loc = useLocationParam();
  const currentLocation = loc && loc !== "all" ? loc : null;

  const when = formatInZone(a.interviewAt, a.locationTimezone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function openResume() {
    start(async () => {
      const res = await getResumeUrl(a.id);
      if (res.url) window.open(res.url, "_blank", "noopener");
      else setMsg(res.error);
    });
  }
  function moveBack() {
    start(async () => { await unconfirmInterview(a.id); });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">{a.name}</div>
          <div className="text-[13px] text-muted mt-0.5">{a.department || "Any role"}{a.locationName ? ` · ${a.locationName}` : ""}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick-dark bg-brick-tint px-3 py-1 rounded-full shrink-0">
          <CalendarCheck size={13} /> {when}
        </span>
      </div>

      {(a.email || a.phone) && <div className="text-[13px] text-charcoal-2 mt-2">{[a.email, a.phone].filter(Boolean).join(" · ")}</div>}
      {a.interviewDetails && <p className="text-[13px] text-muted mt-1"><span className="font-semibold text-charcoal-2">Details:</span> {a.interviewDetails}</p>}

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line">
        <Link
          href={`/hiring?app=${a.id}&an=${encodeURIComponent(a.name)}${a.department ? `&scoreDept=${encodeURIComponent(a.department)}` : ""}${a.locationId ? `&scoreLoc=${a.locationId}` : ""}${currentLocation ? `&location=${encodeURIComponent(currentLocation)}` : ""}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark"
        >
          <UserPlus size={13} /> Interview &amp; score
        </Link>
        {a.hasResume && (
          <button onClick={openResume} disabled={pending} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/30 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50">
            <Paperclip size={13} /> Resume
          </button>
        )}
        <button onClick={moveBack} disabled={pending} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-2 hover:text-ink disabled:opacity-50">
          <Undo2 size={13} /> Back to applications
        </button>
        {msg && <span className="text-[12.5px] text-danger self-center">{msg}</span>}
      </div>
    </div>
  );
}
