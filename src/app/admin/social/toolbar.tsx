"use client";

import { useActionState, useState } from "react";
import { Composer } from "./composer";
import { importPosts, type SocialFormState } from "./actions";

const initial: SocialFormState = { error: null, ok: false };

const SAMPLE = `[
  {
    "caption": "You pay to win a guest once — then lose them out the bottom.",
    "link": "https://www.joinwingman.app/demo",
    "first_comment": "#restauranttech #hospitality",
    "platforms": ["instagram", "facebook"],
    "scheduled_at": "2026-07-15T09:00"
  }
]`;

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(importPosts, initial);
  if (state.ok) onDone();
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Paste a JSON array of posts (from Claude Design). Each needs a <code>caption</code>; optional{" "}
        <code>link</code>, <code>first_comment</code>, <code>platforms</code>, and <code>scheduled_at</code>. Posts with a time come in
        scheduled; without, as drafts. Images you add after importing.
      </p>
      <textarea
        name="json"
        rows={10}
        defaultValue=""
        placeholder={SAMPLE}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none focus:border-brick font-mono leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import posts"}
        </button>
        <button type="button" onClick={onDone} className="text-[14px] text-muted-2 hover:text-ink">
          Cancel
        </button>
        {state.error && <span className="text-[14px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function SocialToolbar() {
  const [open, setOpen] = useState<"none" | "new" | "import">("none");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? "none" : "new")}
          className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
        >
          + New post
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "import" ? "none" : "import")}
          className="text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-5 py-2.5 hover:border-brick hover:text-brick transition-colors"
        >
          Import from Claude Design
        </button>
      </div>

      {open === "new" && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <Composer onDone={() => setOpen("none")} />
        </div>
      )}
      {open === "import" && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <ImportPanel onDone={() => setOpen("none")} />
        </div>
      )}
    </div>
  );
}
