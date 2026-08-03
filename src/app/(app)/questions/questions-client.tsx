"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Check, BookOpen } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { answerQuestion } from "./actions";

export type QuestionRow = {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  asked_by_name: string;
  answered_by_name: string | null;
  answered_at: string | null;
  saved_to_playbook: boolean;
  created_at: string;
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function QuestionsClient({ rows, canAnswer }: { rows: QuestionRow[]; canAnswer: boolean }) {
  const open = rows.filter((r) => r.status !== "answered");
  const answered = rows.filter((r) => r.status === "answered");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">
          {canAnswer ? "Staff questions" : "Your questions"}
        </h1>
        <p className="text-base text-muted max-w-xl">
          {canAnswer
            ? "Questions your team asked the Ask Wingman assistant that need a manager's answer. Answer once and save it to your Team Playbook — the assistant will handle it automatically next time."
            : "Questions you sent to your managers from the assistant, and their answers."}
        </p>
      </div>

      {rows.length === 0 && (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <MessageCircleQuestion className="mx-auto text-muted-2 mb-2" size={26} />
          <p className="text-[15px] text-muted">
            {canAnswer
              ? "No questions yet. When someone asks the assistant something it can't answer and taps “Ask a manager,” it lands here."
              : "You haven't asked a manager anything yet. When the assistant can't answer, tap “Ask a manager” and it'll come here."}
          </p>
        </div>
      )}

      {open.length > 0 && (
        <div className="flex flex-col gap-3">
          {canAnswer && <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2">Waiting for an answer</div>}
          {open.map((r) => (canAnswer ? <AnswerCard key={r.id} row={r} /> : <StaffCard key={r.id} row={r} />))}
        </div>
      )}

      {answered.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2">Answered</div>
          {answered.map((r) => (
            <StaffCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffCard({ row }: { row: QuestionRow }) {
  const isAnswered = row.status === "answered";
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-semibold text-ink">{row.question}</p>
        <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${isAnswered ? "bg-olive-tint text-olive" : "bg-gold-tint text-[#b45309]"}`}>
          {isAnswered ? "Answered" : "Waiting"}
        </span>
      </div>
      <div className="text-[12px] text-muted-2 mt-1">
        Asked by {row.asked_by_name} · {when(row.created_at)}
      </div>
      {isAnswered && row.answer && (
        <div className="mt-3 rounded-xl bg-paper border border-line p-3.5">
          <div className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">{row.answer}</div>
          <div className="text-[12px] text-muted-2 mt-2 flex items-center gap-2 flex-wrap">
            <span>— {row.answered_by_name}{row.answered_at ? ` · ${when(row.answered_at)}` : ""}</span>
            {row.saved_to_playbook && (
              <span className="inline-flex items-center gap-1 text-olive"><BookOpen size={12} /> Saved to Team Playbook</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerCard({ row }: { row: QuestionRow }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await answerQuestion({ id: row.id, answer, saveToPlaybook: save });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <p className="text-[15px] font-semibold text-ink">{row.question}</p>
      <div className="text-[12px] text-muted-2 mt-1">
        Asked by {row.asked_by_name} · {when(row.created_at)}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Write the answer your team should get…"
        className={`${inputClass} resize-y mt-3`}
      />
      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-[13px] text-charcoal-2 cursor-pointer select-none">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="accent-brick w-4 h-4" />
          <BookOpen size={14} className="text-muted-2" /> Save to Team Playbook (the assistant will use it next time)
        </label>
        <Btn small icon={Check} onClick={submit} loading={pending} disabled={pending || answer.trim().length < 2}>
          {pending ? "Sending…" : "Send answer"}
        </Btn>
      </div>
      {error && <p className="text-[12.5px] text-danger mt-2">{error}</p>}
    </div>
  );
}
