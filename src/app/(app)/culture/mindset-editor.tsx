"use client";

import { useState, useTransition, useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { updateCultureText, type ActionState } from "./actions";
import { generateOwnerMindset } from "./mindset-actions";

const initialState: ActionState = { error: null };

// Owner-facing editor for the Owner's Mindset manifesto: write it by hand, or
// have AI draft/sharpen it from the restaurant's philosophy. Saves via the
// shared culture text updater (field "owner_mindset").
export function MindsetEditor({ initialValue }: { initialValue: string }) {
  const [state, formAction, saving] = useActionState(updateCultureText, initialState);
  const [value, setValue] = useState(initialValue);
  const [genPending, startGen] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);

  function generate() {
    setGenError(null);
    startGen(async () => {
      const res = await generateOwnerMindset(value);
      if (res.error) setGenError(res.error);
      else if (res.mindset) setValue(res.mindset);
    });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="field" value="owner_mindset" />
      <textarea
        name="value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder="Run it like you own it…"
        className="w-full rounded-lg p-3 text-sm bg-panel border border-line text-ink leading-relaxed resize-y"
      />
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <button
          type="button"
          onClick={generate}
          disabled={genPending}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50"
        >
          <Sparkles size={13} /> {genPending ? "Writing…" : value.trim() ? "Rewrite with AI" : "Generate with AI"}
        </button>
        <Btn small type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Btn>
      </div>
      {genError && <p className="text-sm text-brick mt-1">{genError}</p>}
      {state.error && <p className="text-sm text-brick mt-1">{state.error}</p>}
    </form>
  );
}
