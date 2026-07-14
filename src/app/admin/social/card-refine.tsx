"use client";

import { useState, useTransition } from "react";
import { rerenderCardManual, regenerateCardAi } from "./card-refine-actions";

const SCHEMES: { key: string; label: string; dot: string }[] = [
  { key: "blue", label: "Blue", dot: "#0a6cff" },
  { key: "charcoal", label: "Charcoal", dot: "#14161a" },
  { key: "cream", label: "Cream", dot: "#f5f3ec" },
];

// Refine the branded GRAPHIC on an existing FB/IG draft — either regenerate it
// from the caption with AI, or type the exact line and pick the color yourself.
// (Caption, link, scheduled date & images are edited via the "Edit" button.)
export function CardRefine({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [scheme, setScheme] = useState("blue");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function runAi() {
    setError(null);
    start(async () => {
      const res = await regenerateCardAi(postId);
      if (res.error) setError(res.error);
    });
  }
  function runManual() {
    setError(null);
    if (!headline.trim()) {
      setError("Enter the text for the card.");
      return;
    }
    start(async () => {
      const res = await rerenderCardManual(postId, headline, scheme);
      if (res.error) setError(res.error);
      else setHeadline("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors"
      >
        Refine graphic
      </button>
    );
  }

  return (
    <div className="w-full mt-1 rounded-xl border border-line bg-paper p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-charcoal-2">Refine the graphic</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted-2 hover:text-ink">
          Close
        </button>
      </div>

      {/* AI regenerate — one click, drafts a fresh card from this post's caption. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={runAi}
          disabled={pending}
          className="text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Working…" : "Regenerate with AI"}
        </button>
        <span className="text-[12px] text-muted">Drafts a new card from this post&rsquo;s caption.</span>
      </div>

      <div className="border-t border-line" />

      {/* Manual — full control: type the line, pick the color. */}
      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-semibold text-charcoal-2">Or write the card yourself</label>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={2}
          maxLength={160}
          placeholder="The one line for the card…"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink resize-none focus:border-brick focus:outline-none"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-muted">Color:</span>
          {SCHEMES.map((sc) => (
            <button
              key={sc.key}
              type="button"
              onClick={() => setScheme(sc.key)}
              className={`flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                scheme === sc.key ? "border-brick text-brick" : "border-line text-charcoal-2 hover:border-brick/50"
              }`}
            >
              <span className="w-3 h-3 rounded-full border border-line" style={{ background: sc.dot }} /> {sc.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={runManual}
            disabled={pending}
            className="text-[13px] font-semibold text-white bg-olive rounded-full px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {pending ? "Rendering…" : "Re-render card"}
          </button>
        </div>
      </div>

      {error && <p className="text-[12px] text-danger bg-[#FDECEC] rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
