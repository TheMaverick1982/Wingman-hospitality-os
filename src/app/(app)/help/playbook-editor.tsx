"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, ChevronRight, BookOpen } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { savePlaybookArticle, deletePlaybookArticle, type PlaybookArticle, type PlaybookState } from "./playbook-actions";

const initialState: PlaybookState = { error: null };

export function PlaybookSection({ articles, canEdit }: { articles: PlaybookArticle[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<PlaybookArticle | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <BookOpen size={18} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink">Your team&apos;s playbook</div>
            <div className="text-[13px] text-muted-2">Guides and SOPs your team wrote — just for your organization.</div>
          </div>
        </div>
        {canEdit && (
          <Btn small kind="ghost" icon={Plus} onClick={() => setAdding(true)}>
            Add guide
          </Btn>
        )}
      </div>

      {articles.length > 0 ? (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F5F5F5] last:border-0 hover:bg-paper transition-colors">
              <Link href={`/help/playbook/${a.id}`} className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">{a.title}</div>
              </Link>
              {canEdit && (
                <button type="button" onClick={() => setEditing(a)} className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70 shrink-0">
                  Edit
                </button>
              )}
              <Link href={`/help/playbook/${a.id}`} className="shrink-0">
                <ChevronRight size={17} className="text-muted-2" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl px-5 py-6 text-center shadow-sm">
          <p className="text-sm text-muted">
            {canEdit ? "No guides yet. Add your first SOP or team guide." : "Your team hasn't added any guides yet."}
          </p>
        </div>
      )}

      {(adding || editing) && (
        <PlaybookModal article={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </div>
  );
}

function PlaybookModal({ article, onClose }: { article: PlaybookArticle | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(savePlaybookArticle, initialState);
  useCloseOnSuccess(pending, state.error, onClose);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  function doDelete() {
    if (!article) return;
    if (!window.confirm(`Delete "${article.title}"? This can't be undone.`)) return;
    setRemoveError(null);
    startRemove(async () => {
      const res = await deletePlaybookArticle(article.id);
      if (res.error) setRemoveError(res.error);
      else onClose();
    });
  }

  return (
    <Modal title={article ? "Edit guide" : "Add a guide"} sub="Write a guide or SOP for your team. Everyone in your org can read it." onClose={onClose} wide>
      <form action={formAction}>
        {article && <input type="hidden" name="id" value={article.id} />}
        <Field label="Title">
          <input name="title" required defaultValue={article?.title ?? ""} placeholder="e.g. Opening checklist for the bar" className={inputClass} />
        </Field>
        <Field label="Guide">
          <textarea
            name="body"
            rows={12}
            defaultValue={article?.body ?? ""}
            placeholder={"Write your guide here.\n\nUse:\n# Heading   for a section heading\n- item      for a bullet\nblank line  for a new paragraph"}
            className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
          />
        </Field>
        <p className="text-xs text-muted-2 -mt-1 mb-3">
          Formatting: start a line with <code>#</code> for a heading or <code>-</code> for a bullet; leave a blank line between paragraphs.
        </p>

        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        {removeError && <p className="text-sm text-danger mb-2">{removeError}</p>}

        <div className="flex items-center justify-between gap-2 mt-2">
          {article ? (
            <button type="button" onClick={doDelete} disabled={removing} className="text-sm font-semibold text-brick hover:opacity-70 disabled:opacity-50">
              {removing ? "Deleting…" : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Btn type="button" kind="ghost" onClick={onClose}>
              Cancel
            </Btn>
            <Btn type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save guide"}
            </Btn>
          </div>
        </div>
      </form>
    </Modal>
  );
}
