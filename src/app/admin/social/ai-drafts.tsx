"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, Check, Images } from "lucide-react";
import { generateDraftsAction, saveContentBrief } from "./generate-actions";

export function AiDrafts({ initialBrief, initialAuto }: { initialBrief: string; initialAuto: boolean }) {
  const [count, setCount] = useState(15);
  const [gen, startGen] = useTransition();
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(initialBrief);
  const [auto, setAuto] = useState(initialAuto);
  const [saveState, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function generate() {
    setGenErr(null); setGenMsg(null);
    startGen(async () => {
      const res = await generateDraftsAction(count);
      if (res.error) setGenErr(res.error);
      else setGenMsg(`Created ${res.created} draft post${res.created === 1 ? "" : "s"} (Facebook + Instagram cards + LinkedIn text). Review them below, then approve to schedule.`);
    });
  }
  function save() {
    setSaved(false);
    startSave(async () => {
      await saveContentBrief(brief, auto);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center shrink-0"><Sparkles size={18} /></span>
          <div>
            <div className="text-[16px] font-semibold text-ink">Generate posts with AI</div>
            <p className="text-[13px] text-muted mt-0.5 max-w-xl">
              Writes fresh posts in your voice and draws the branded cards (Facebook &amp; Instagram); LinkedIn is text-only.
              Everything lands as a <span className="font-semibold text-ink">draft</span> — nothing publishes until you approve it.
            </p>
          </div>
        </div>
        <Link href="/admin/social/cards" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick shrink-0">
          <Images size={13} /> Card styles
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-[13px] text-charcoal-2">
          How many
          <input type="number" min={1} max={15} value={count} onChange={(e) => setCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} className="w-16 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[14px] text-ink outline-none focus:border-brick" />
        </label>
        <button onClick={generate} disabled={gen} className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark disabled:opacity-60">
          {gen && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {gen ? "Generating…" : `Generate ${count} drafts`}
        </button>
        {genMsg && <span className="text-[13px] text-olive font-semibold">{genMsg}</span>}
        {genErr && <span className="text-[13px] text-danger">{genErr}</span>}
      </div>
      {gen && <p className="text-[12px] text-muted-2">Writing copy and rendering cards — this can take a minute for a full batch. Don&rsquo;t refresh.</p>}

      <div className="border-t border-line pt-3">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick">
          <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} /> Content brief &amp; auto-generate
        </button>
        {open && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-[12.5px] text-muted-2">Paste your brand voice, angles, and rules here — the AI writes from this. Leave blank to use the built-in Wingman brief.</p>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={10} placeholder="Your content brief / voice / rules…" className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] text-ink outline-none focus:border-brick font-mono leading-relaxed" />
            <label className="inline-flex items-center gap-2 text-[13px] text-charcoal-2">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-brick" />
              Auto-generate a fresh batch when my scheduled queue runs low (still lands as drafts for review)
            </label>
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={saveState} className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-60">{saveState ? "Saving…" : "Save brief"}</button>
              {saved && <span className="inline-flex items-center gap-1 text-[13px] text-olive font-semibold"><Check size={14} /> Saved</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
