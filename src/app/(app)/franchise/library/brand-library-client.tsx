"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock, Check, Loader2, Users } from "lucide-react";
import { pushBrandTestAction } from "./actions";
import type { BrandLibraryTest } from "@/lib/franchise-brand";

export function BrandLibraryClient({ tests }: { tests: BrandLibraryTest[] }) {
  if (tests.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center text-sm text-muted-2">
        No tests in your Training yet. Build one under Training → Tests, then come back to push it to your franchisees.
      </div>
    );
  }
  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm divide-y divide-line">
      {tests.map((t) => (
        <Row key={t.id} test={t} />
      ))}
    </div>
  );
}

function Row({ test }: { test: BrandLibraryTest }) {
  const [locked, setLocked] = useState(true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const push = () => {
    setMsg(null);
    start(async () => {
      const r = await pushBrandTestAction(test.id, locked);
      if (r.error) setMsg({ ok: false, text: r.error });
      else setMsg({ ok: true, text: `Pushed to ${r.pushed} franchisee${r.pushed === 1 ? "" : "s"}${locked ? " (locked)" : ""}.` });
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-ink truncate">{test.title}</div>
        <div className="text-[12.5px] text-muted-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>{test.departments.length ? test.departments.join(", ") : "All staff"}</span>
          {test.pushedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[#15803d]">
              <Users size={12} /> live at {test.pushedCount} franchisee{test.pushedCount === 1 ? "" : "s"}
              {test.locked ? " · locked" : ""}
            </span>
          )}
        </div>
        {msg && <p className={`text-[12.5px] mt-1 ${msg.ok ? "text-olive" : "text-danger"}`}>{msg.text}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setLocked((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${locked ? "border-ink text-ink bg-paper" : "border-line text-muted-2"}`}
          title={locked ? "Locked: franchisees can't edit" : "Adaptable: franchisees can localize"}
        >
          {locked ? <Lock size={13} /> : <Unlock size={13} />} {locked ? "Locked" : "Adaptable"}
        </button>
        <button
          type="button"
          onClick={push}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {pending ? "Pushing…" : test.pushedCount > 0 ? "Re-push update" : "Push to franchisees"}
        </button>
      </div>
    </div>
  );
}
