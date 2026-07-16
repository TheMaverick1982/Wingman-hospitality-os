"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Save, Send, Trash2, Pencil, CalendarClock, CheckCircle2, Check, Share2 } from "lucide-react";
import { generateDraftAction, savePostAction, setStatusAction, deletePostAction, approveAction, generateMonthAction, shareToFacebookAction } from "./actions";
import type { Post, PostStatus } from "@/lib/playbook";

const STATUS_STYLE: Record<string, string> = {
  draft: "text-[#B45309] bg-gold-tint",
  scheduled: "text-charcoal-2 bg-paper",
  published: "text-olive bg-olive-tint",
};
const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick";

function fmtDT(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function Composer({ categories, posts, lastScheduled, pendingApproval, scheduledCount }: { categories: string[]; posts: Post[]; lastScheduled: string | null; pendingApproval: number; scheduledCount: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Draft form state
  const [id, setId] = useState<string | null>(null);
  const [category, setCategory] = useState(categories[0] ?? "General");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [keywords, setKeywords] = useState("");
  const [generating, setGenerating] = useState(false);

  const reset = () => { setId(null); setTitle(""); setExcerpt(""); setBody(""); setKeywords(""); setTopic(""); };

  const generate = () => {
    setErr(null); setGenerating(true);
    start(async () => {
      const r = await generateDraftAction(category, topic);
      setGenerating(false);
      if (r.error || !r.draft) { setErr(r.error ?? "Couldn't generate."); return; }
      setId(null);
      setTitle(r.draft.title); setExcerpt(r.draft.excerpt); setBody(r.draft.body);
      setKeywords(r.draft.keywords.join(", ")); setCategory(r.draft.category || category);
    });
  };

  const save = (status: PostStatus) => {
    setErr(null);
    start(async () => {
      const r = await savePostAction({ id, title, excerpt, body, category, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean), status, scheduledFor: null });
      if (r.error) setErr(r.error);
      else reset();
    });
  };

  const edit = (p: Post) => {
    setId(p.id); setTitle(p.title); setExcerpt(p.excerpt); setBody(p.body); setCategory(p.category); setKeywords(p.keywords.join(", ")); setErr(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Schedule status + month generator */}
      <div className="bg-white border border-line rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <CalendarClock size={17} className="text-brick" />
          <div className="text-[13.5px] text-charcoal-2">
            <span className="font-semibold text-ink">{scheduledCount}</span> scheduled{pendingApproval > 0 && <span className="text-[#B45309] font-semibold"> · {pendingApproval} awaiting your approval</span>}
            {lastScheduled && <span className="text-muted-2"> · booked through {fmtDT(lastScheduled)}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setErr(null); setNote(null); start(async () => { const r = await generateMonthAction(); if (r.error) setErr(r.error); else setNote(`Drafted and scheduled ${r.created} post${r.created === 1 ? "" : "s"}. Review and approve them below.`); }); }}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-ink rounded-full px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles size={14} /> Generate &amp; schedule a month
        </button>
      </div>
      {note && <div className="text-[13px] text-[#15803d] font-medium">{note}</div>}

      {/* Composer */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-ink">{id ? "Edit post" : "New post"}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[12.5px] font-semibold text-charcoal-2 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[12.5px] font-semibold text-charcoal-2 mb-1">Topic for AI <span className="font-normal text-muted-2">(optional)</span></label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Leave blank to let it pick a strong angle" className={input} />
          </div>
          <button type="button" onClick={generate} disabled={pending} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-ink rounded-full px-4 py-2.5 hover:opacity-90 disabled:opacity-50">
            {generating ? <><Loader2 size={15} className="animate-spin" /> Writing…</> : <><Sparkles size={15} /> Generate draft</>}
          </button>
        </div>

        <label className="block text-[12.5px] font-semibold text-charcoal-2">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        <label className="block text-[12.5px] font-semibold text-charcoal-2">Excerpt</label>
        <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={input} />
        <label className="block text-[12.5px] font-semibold text-charcoal-2">Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className={`${input} resize-y font-mono text-[13px] leading-[1.6]`} />
        <label className="block text-[12.5px] font-semibold text-charcoal-2">Keywords <span className="font-normal text-muted-2">(comma-separated)</span></label>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={input} />

        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => save("draft")} disabled={pending || !title.trim()} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2.5 hover:border-brick disabled:opacity-50"><Save size={15} /> Save draft</button>
          <button type="button" onClick={() => save("published")} disabled={pending || !title.trim() || !body.trim()} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50"><Send size={15} /> Publish now</button>
          {id && <button type="button" onClick={reset} className="text-[13px] font-semibold text-muted-2 hover:text-ink">Cancel edit</button>}
          {err && <span className="text-[13px] text-danger">{err}</span>}
        </div>
      </div>

      {/* Post list */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line text-[13px] font-semibold text-ink">All posts ({posts.length})</div>
        {posts.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted">No posts yet. Draft your first above.</div>
        ) : (
          <div className="divide-y divide-line">
            {posts.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold text-ink truncate">{p.title}</div>
                  <div className="text-[12.5px] text-muted-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span>{p.category}</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                    {p.status === "scheduled" && p.scheduledFor && <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> {fmtDT(p.scheduledFor)}</span>}
                    {p.status === "scheduled" && (p.approved ? <span className="inline-flex items-center gap-1 text-[#15803d] font-semibold"><Check size={11} /> approved</span> : <span className="text-[#B45309] font-semibold">needs approval</span>)}
                    {p.status === "published" && <span>{p.views} view{p.views === 1 ? "" : "s"}</span>}
                    {p.status === "published" && (p.facebookPostedAt
                      ? <span className="inline-flex items-center gap-1 text-[#1877F2] font-semibold"><Share2 size={11} /> on Facebook</span>
                      : <span className="text-[#B45309] font-semibold">not on Facebook yet</span>)}
                    {p.status === "published" && <Link href={`/playbook/${p.slug}`} target="_blank" className="text-brick font-semibold">View →</Link>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/playbook/${p.slug}/opengraph-image`} target="_blank" className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick" title="Preview the Facebook/social share card">Card</Link>
                  <button type="button" onClick={() => edit(p)} className="text-muted-2 hover:text-ink" title="Edit"><Pencil size={15} /></button>
                  {p.status === "scheduled" && !p.approved && (
                    <button type="button" disabled={pending} onClick={() => start(async () => { const r = await approveAction(p.id); if (r.error) setErr(r.error); })} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white bg-[#15803d] rounded-full px-3 py-1 hover:opacity-90 disabled:opacity-50"><CheckCircle2 size={13} /> Approve</button>
                  )}
                  {p.status !== "published" ? (
                    <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setStatusAction(p.id, "published"); if (r.error) setErr(r.error); })} className="text-[12.5px] font-semibold text-white bg-brick rounded-full px-3 py-1 hover:bg-brick-dark disabled:opacity-50">Publish now</button>
                  ) : (
                    <>
                      {!p.facebookPostedAt && (
                        <button type="button" disabled={pending} onClick={() => { setErr(null); setNote(null); start(async () => { const r = await shareToFacebookAction(p.id); if (r.error) setErr(r.error); else setNote(r.already ? "Already on Facebook." : "Shared to Facebook."); }); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white bg-[#1877F2] rounded-full px-3 py-1 hover:opacity-90 disabled:opacity-50" title="Push this post to the connected Facebook page"><Share2 size={12} /> Share to FB</button>
                      )}
                      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setStatusAction(p.id, "draft"); if (r.error) setErr(r.error); })} className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick px-2">Unpublish</button>
                    </>
                  )}
                  <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Delete "${p.title}"?`)) start(async () => { const r = await deletePostAction(p.id); if (r.error) setErr(r.error); }); }} className="text-muted-2 hover:text-danger" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
