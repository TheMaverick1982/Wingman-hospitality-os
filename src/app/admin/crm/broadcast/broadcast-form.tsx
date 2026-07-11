"use client";

import { useActionState, useMemo, useState } from "react";
import { sendBroadcast, type BroadcastState } from "./actions";

const initial: BroadcastState = { error: null, sent: null, skipped: null };

export function BroadcastForm({ tags }: { tags: { tag: string; count: number }[] }) {
  const [state, action, pending] = useActionState(sendBroadcast, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [test, setTest] = useState(false);

  // Upper bound — a contact with two selected tags is counted once per tag, so
  // the real (deduped) send may be smaller.
  const upperBound = useMemo(
    () => tags.filter((t) => selected.includes(t.tag)).reduce((s, t) => s + t.count, 0),
    [tags, selected]
  );

  function toggle(tag: string) {
    setSelected((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!test && !confirm(`Send this email to up to ${upperBound} contact${upperBound === 1 ? "" : "s"}? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
      className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start"
    >
      {/* Tag picker */}
      <div className="bg-white border border-line rounded-2xl p-5">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-3">Audience (match any tag)</div>
        <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
          {tags.map((t) => (
            <label key={t.tag} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-paper cursor-pointer">
              <input
                type="checkbox"
                name="tags"
                value={t.tag}
                checked={selected.includes(t.tag)}
                onChange={() => toggle(t.tag)}
                className="accent-brick"
              />
              <span className="flex-1 text-[13.5px] text-ink font-mono">{t.tag}</span>
              <span className="text-[12px] text-muted-2 tabular-nums">{t.count}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-line text-[13px] text-muted">
          {selected.length === 0 ? "No tags selected" : `Up to ${upperBound} recipient${upperBound === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Subject</label>
          <input
            name="subject"
            required
            placeholder="A quick update for our affiliates"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brick"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Message</label>
          <textarea
            name="body"
            required
            rows={12}
            placeholder={"Hi {{first_name}},\n\nWrite your update here. Plain text — links become clickable, and an unsubscribe footer is added automatically."}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brick font-mono leading-relaxed"
          />
          <p className="text-[12px] text-muted-2 mt-1.5">
            Merge fields: <code>{"{{first_name}}"}</code>. Reply-To is hello@joinwingman.app. Unsubscribed contacts are always skipped.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-[13.5px] text-charcoal-2">
          <input type="checkbox" name="test" checked={test} onChange={(e) => setTest(e.target.checked)} className="accent-brick" />
          Send a test to myself first (doesn&rsquo;t email the audience)
        </label>
        {test && (
          <input
            name="testEmail"
            type="email"
            placeholder="you@joinwingman.app"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brick"
          />
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending || selected.length === 0}
            className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors disabled:opacity-50"
          >
            {pending ? "Sending…" : test ? "Send test" : "Send broadcast"}
          </button>
          {state.sent !== null && !state.error && (
            <span className="text-[14px] text-olive font-semibold">
              {test ? "Test sent." : `Sent to ${state.sent} contact${state.sent === 1 ? "" : "s"}.`}
            </span>
          )}
          {state.error && <span className="text-[14px] text-danger">{state.error}</span>}
        </div>
      </div>
    </form>
  );
}
