"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, Lightbulb, Loader2, Plus } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { IDEA_STATUS_META, type Idea, type IdeaStatus } from "@/lib/feature-ideas";
import { submitIdea, toggleVote, setIdeaStatus, type SubmitIdeaState } from "./actions";

const initial: SubmitIdeaState = { error: null };

export function SubmitIdea() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitIdea, initial);
  useCloseOnSuccess(pending, state.error, () => {
    setOpen(false);
    router.refresh();
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors self-start"
      >
        <Plus size={16} /> Suggest an idea
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <Lightbulb size={17} className="text-brick" /> Suggest a feature
      </div>
      <input name="title" required maxLength={140} placeholder="Short title — e.g. Text guests their bounce-back offer" className={inputClass} autoFocus />
      <textarea name="details" rows={3} maxLength={2000} placeholder="Optional: what would it do, and what problem does it solve?" className={inputClass} />
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-[13.5px] font-semibold text-muted hover:text-ink px-4 py-2.5">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50 flex items-center gap-2">
          {pending ? <><Loader2 size={14} className="animate-spin" /> Posting…</> : "Post idea"}
        </button>
      </div>
    </form>
  );
}

export function IdeaList({ ideas, isPlatformAdmin }: { ideas: Idea[]; isPlatformAdmin: boolean }) {
  if (ideas.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl p-10 text-center text-sm text-muted">
        No ideas yet — be the first to suggest one.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} isPlatformAdmin={isPlatformAdmin} />
      ))}
    </div>
  );
}

function IdeaCard({ idea, isPlatformAdmin }: { idea: Idea; isPlatformAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const badge = IDEA_STATUS_META[idea.status];
  // Optimistic vote state so the tap feels instant.
  const [voted, setVoted] = useState(idea.voted);
  const [count, setCount] = useState(idea.votes);

  const vote = () =>
    start(async () => {
      const next = !voted;
      setVoted(next);
      setCount((c) => c + (next ? 1 : -1));
      const res = await toggleVote(idea.id);
      if (res.error) {
        setVoted(!next);
        setCount((c) => c + (next ? -1 : 1));
        return;
      }
      router.refresh();
    });

  const changeStatus = (status: string) =>
    start(async () => {
      await setIdeaStatus(idea.id, status);
      router.refresh();
    });

  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm flex items-start gap-4">
      <button
        onClick={vote}
        disabled={pending}
        aria-pressed={voted}
        className={`shrink-0 w-[54px] flex flex-col items-center justify-center rounded-xl border py-2 transition-colors disabled:opacity-60 ${
          voted ? "bg-brick-tint border-brick/40 text-brick-dark" : "bg-paper border-line text-charcoal-2 hover:border-brick"
        }`}
      >
        <ChevronUp size={18} strokeWidth={2.5} />
        <span className="text-[15px] font-bold tabular-nums">{count}</span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-ink">{idea.title}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
        </div>
        {idea.details && <p className="text-[13.5px] text-muted mt-1 whitespace-pre-wrap">{idea.details}</p>}

        {isPlatformAdmin && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted-2">Set status:</span>
            <select
              value={idea.status}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={pending}
              className="text-[12.5px] border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-brick"
            >
              {(Object.keys(IDEA_STATUS_META) as IdeaStatus[]).map((s) => (
                <option key={s} value={s}>
                  {IDEA_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
