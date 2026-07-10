"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Trash2, Plus, Check, X, Wand2, Sparkles, Upload, Clipboard } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import {
  addAccountabilityItem,
  updateAccountabilityItemText,
  deleteAccountabilityItem,
  generateAccountabilityChecklist,
  saveAccountabilityChecklist,
  type ChecklistType,
  type TemplateItem,
  type ItemState,
  type BuildState,
} from "./template-actions";

const addInitial: ItemState = { error: null };
const buildInitial: BuildState = { error: null };

export function ChecklistTemplateEditor({
  checklistType,
  title,
  items,
}: {
  checklistType: ChecklistType;
  title: string;
  items: TemplateItem[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addState, addAction, addPending] = useActionState(addAccountabilityItem, addInitial);
  useCloseOnSuccess(addPending, addState.error, () => setShowAdd(false));
  const [, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(() => deleteAccountabilityItem(checklistType, id));
  }

  function saveEdit() {
    if (!editingId) return;
    const text = draft.trim();
    if (text) startTransition(() => updateAccountabilityItemText(checklistType, editingId, text));
    setEditingId(null);
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <ChecklistBuilder checklistType={checklistType} label={title} />
      </div>

      <div className="flex flex-col gap-2.5 mb-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 group">
            <span className="mt-1 w-3.5 h-3.5 rounded-[4px] border-2 border-brick shrink-0" />
            {editingId === item.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className={`${inputClass} flex-1 py-1.5 text-sm`}
                />
                <button onClick={saveEdit} className="text-olive shrink-0">
                  <Check size={15} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-muted-2 shrink-0">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm leading-relaxed text-charcoal-2 flex-1">{item.item}</span>
                {item.source === "custom" && <Pill tone="muted">Custom</Pill>}
                <div className="hidden group-hover:flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setDraft(item.item);
                    }}
                    className="text-muted-2 hover:text-ink"
                  >
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(item.id)} className="text-muted-2 hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <form action={addAction} className="flex items-center gap-2 mt-1">
          <input type="hidden" name="checklistType" value={checklistType} />
          <input name="text" placeholder="Add an item..." autoFocus className={`${inputClass} flex-1 py-1.5 text-sm`} />
          <button type="submit" className="text-olive shrink-0" disabled={addPending}>
            <Check size={15} />
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="text-muted-2 shrink-0">
            <X size={15} />
          </button>
          {addState.error && <p className="text-xs text-danger">{addState.error}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-xs font-semibold text-brick mt-1">
          <Plus size={13} /> Add item
        </button>
      )}
    </div>
  );
}

function BuilderItemList({ items, setItems }: { items: string[]; setItems: (v: string[]) => void }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink mb-2">
        Checklist items <span className="text-muted-2">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={it}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${inputClass} text-[13px] py-1.5`}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              aria-label="Remove item"
              className="shrink-0 text-muted-2 hover:text-danger"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">None — removed.</p>}
      </div>
    </div>
  );
}

function ChecklistBuilder({ checklistType, label }: { checklistType: ChecklistType; label: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "upload" | "wizard">("paste");
  const [state, formAction, pending] = useActionState(generateAccountabilityChecklist, buildInitial);

  // Review state.
  const [items, setItems] = useState<string[]>([]);
  const [ignore, setIgnore] = useState(true);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const reviewing = state.items != null && !ignore;

  // Fresh preview arrives → load it into the editable review list. Syncing an
  // async action result into local editable state is the intended use here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.items) {
      setItems(state.items);
      setIgnore(false);
      setSaved(null);
      setSaveError(null);
    }
  }, [state.items]);

  // Reset to the input step each time the modal opens.
  useEffect(() => {
    if (open) {
      setIgnore(true);
      setSaved(null);
      setSaveError(null);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Confirm the save briefly, then close so the new checklist is visible on the page.
  useEffect(() => {
    if (saved != null) {
      const t = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function doSave() {
    setSaveError(null);
    startSave(async () => {
      const res = await saveAccountabilityChecklist(checklistType, items);
      if (res.error) setSaveError(res.error);
      else setSaved(res.built ?? items.length);
    });
  }

  return (
    <>
      <Btn small kind="info" icon={Wand2} onClick={() => setOpen(true)}>
        Build with AI
      </Btn>
      {open && (
        <Modal
          title={reviewing ? `Review ${label}` : `Build ${label}`}
          sub={
            reviewing
              ? "Edit or remove anything below, then save. Nothing changes until you save."
              : "Upload what you already use, or let Wingman build it from scratch -- guest experience woven in alongside operational discipline."
          }
          onClose={() => setOpen(false)}
          wide
        >
          {reviewing ? (
            <div>
              <div className="max-h-[52vh] overflow-y-auto pr-1">
                <BuilderItemList items={items} setItems={setItems} />
              </div>
              {saveError && <p className="text-sm text-danger mt-3">{saveError}</p>}
              {saved != null && <p className="text-sm text-[#15803d] mt-3">Saved {saved} items.</p>}
              <div className="flex justify-between gap-2 mt-4">
                <Btn type="button" kind="ghost" onClick={() => setIgnore(true)}>
                  Start over
                </Btn>
                <Btn type="button" onClick={doSave} disabled={saving || saved != null || items.length === 0} icon={Sparkles}>
                  {saving ? "Saving..." : saved != null ? "Saved" : "Save checklist"}
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "paste" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                    <Clipboard size={15} /> Paste text
                  </div>
                  <p className="text-xs text-muted">Paste your checklist — the most reliable way in.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "upload" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                    <Upload size={15} /> Upload a file
                  </div>
                  <p className="text-xs text-muted">A PDF or photo of what you already use.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("wizard")}
                  className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "wizard" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                    <Sparkles size={15} /> Build from scratch
                  </div>
                  <p className="text-xs text-muted">Answer a couple questions and Wingman writes it.</p>
                </button>
              </div>

              <form action={formAction}>
                <input type="hidden" name="checklistType" value={checklistType} />
                <input type="hidden" name="mode" value={mode} />

                {mode === "paste" ? (
                  <div className="mb-2">
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Paste your existing checklist</label>
                    <textarea
                      name="pastedText"
                      rows={7}
                      required
                      placeholder="Paste your checklist items or SOP text here…"
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                ) : mode === "upload" ? (
                  <div className="mb-2">
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Existing checklist document</label>
                    <input
                      type="file"
                      name="file"
                      accept="image/*,application/pdf"
                      required
                      className="text-sm text-charcoal-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm file:font-semibold w-full"
                    />
                    <p className="text-xs text-muted mt-1.5">Best for a clear PDF or sharp photo. If it errors, use Paste instead.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 mb-2">
                    <div>
                      <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                        What&apos;s the #1 recurring issue this checklist should catch?
                      </label>
                      <textarea name="painPoint" rows={2} className={`${inputClass} resize-none`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                        What does &quot;guest experience done right&quot; look like on your floor, that this should reinforce?
                      </label>
                      <textarea name="mustHave" rows={2} className={`${inputClass} resize-none`} />
                    </div>
                  </div>
                )}

                {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}

                <div className="flex justify-end gap-2 mt-4">
                  <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                    Close
                  </Btn>
                  <Btn type="submit" disabled={pending} icon={Sparkles}>
                    {pending ? "Building..." : "Build & review"}
                  </Btn>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
