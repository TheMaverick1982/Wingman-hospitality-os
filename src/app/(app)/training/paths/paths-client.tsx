"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Plus } from "lucide-react";
import { createPathAction } from "./actions";

const initial: { error: string | null; ok?: boolean; id?: string } = { error: null };

export function CreatePathForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createPathAction, initial);

  useEffect(() => {
    if (state.ok && state.id) router.push(`/training/paths/${state.id}`);
  }, [state, router]);

  return (
    <form action={action} className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="text-[15px] font-semibold text-ink">New path</div>
      <input name="title" required placeholder="e.g. New Server — First 2 Weeks" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
      <input name="description" placeholder="Short description (optional)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50">
          <Plus size={15} /> {pending ? "Creating…" : "Create path"}
        </button>
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
