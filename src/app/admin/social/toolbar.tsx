"use client";

import { useActionState, useState } from "react";
import { Composer } from "./composer";
import { importPosts, type SocialFormState } from "./actions";

const initial: SocialFormState = { error: null, ok: false };

const SAMPLE = `[
  {
    "caption": "You pay to win a guest once — then lose them out the bottom.",
    "first_comment": "#restauranttech #hospitality",
    "link": "https://www.joinwingman.app/demo",
    "platforms": ["instagram", "facebook"],
    "scheduled_at": "2026-07-15T09:00:00-04:00",
    "image": "post1.png"
  }
]`;

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(importPosts, initial);
  // state.ok can be true even with a warning message (missing images), so only
  // auto-close on a clean success.
  if (state.ok && !state.error) onDone();
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Paste the JSON plan from Claude Design and select all its image files below — each post&rsquo;s{" "}
        <code>image</code> (or <code>images</code>) filename is matched to the files you upload, so everything lands ready. Posts
        with a <code>scheduled_at</code> come in scheduled; without, as drafts.
      </p>
      <textarea
        name="json"
        rows={9}
        defaultValue=""
        placeholder={SAMPLE}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none focus:border-brick font-mono leading-relaxed"
      />
      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Image files (select all of them at once)</label>
        <input
          type="file"
          name="images"
          multiple
          accept="image/*,video/mp4"
          className="block w-full text-[13px] text-charcoal-2 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-line"
        />
      </div>
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
        {state.ok && state.error && <span className="text-[13px] text-[#b4884a]">Imported{state.error}</span>}
        {!state.ok && state.error && <span className="text-[14px] text-danger">{state.error}</span>}
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
