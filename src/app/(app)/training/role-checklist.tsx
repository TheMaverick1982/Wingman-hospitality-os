"use client";

import { useActionState, useState, useTransition } from "react";
import { Heart, GraduationCap, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import type { StaffMember } from "@/lib/data/staff";
import type { Department } from "@/lib/constants";
import { RoleTrainingBuilder } from "./role-training-builder";
import { RefineTrainingForm } from "./refine-training-form";
import { StartTrainingButton } from "./start-training-button";
import { RoleTestButton } from "./role-test-button";
import { addChecklistItem, updateChecklistItemText, deleteChecklistItem, type ItemState } from "./role-training-actions";
import type { ChecklistItem } from "./training-client";

const addInitial: ItemState = { error: null };

export function RoleChecklist({
  department,
  hospitalityItems,
  roleItems,
  trackLabel,
  canEdit,
  staff,
  locations,
  hasTest,
}: {
  department: Department;
  hospitalityItems: ChecklistItem[];
  roleItems: ChecklistItem[];
  trackLabel: string | null;
  canEdit: boolean;
  staff: StaffMember[];
  locations: Location[];
  hasTest: boolean;
}) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink">{department} training program</h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            {hospitalityItems.length + roleItems.length > 0 && <RefineTrainingForm department={department} />}
            <RoleTrainingBuilder department={department} />
          </div>
        )}
      </div>

      <ItemGroup
        icon={<Heart size={14} className="text-brick" />}
        label="Hospitality & guest experience — the standard"
        labelClass="text-brick"
        accent="accent-brick"
        items={hospitalityItems}
        list="hospitality"
        department={department}
        canEdit={canEdit}
        empty="No standard defined yet for this department."
      />

      {(trackLabel || roleItems.length > 0 || canEdit) && (
        <div className="pt-5 border-t border-line">
          <ItemGroup
            icon={<GraduationCap size={14} className="text-gold" />}
            label={`${trackLabel || "Role-specific"} — role-specific`}
            labelClass="text-[#b45309]"
            accent="accent-gold"
            items={roleItems}
            list="role"
            department={department}
            canEdit={canEdit}
            empty="No role-specific track defined yet."
          />
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-line flex flex-col gap-3">
        {canEdit && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-muted">Verify they learned it — make this an online test.</span>
            <RoleTestButton department={department} hasTest={hasTest} hasTraining={hospitalityItems.length + roleItems.length > 0} />
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">Ready to train someone on this?</span>
          <StartTrainingButton staff={staff} locations={locations} department={department} small />
        </div>
      </div>
    </div>
  );
}

function ItemGroup({
  icon,
  label,
  labelClass,
  accent,
  items,
  list,
  department,
  canEdit,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  labelClass: string;
  accent: string;
  items: ChecklistItem[];
  list: "hospitality" | "role";
  department: string;
  canEdit: boolean;
  empty: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addState, addAction, addPending] = useActionState(addChecklistItem, addInitial);
  useCloseOnSuccess(addPending, addState.error, () => setShowAdd(false));
  const [, startTransition] = useTransition();

  function beginEdit(item: ChecklistItem) {
    setEditingId(item.id);
    setDraft(item.item);
  }

  function saveEdit() {
    if (!editingId) return;
    const text = draft.trim();
    if (text) startTransition(() => updateChecklistItemText(list, editingId, text));
    setEditingId(null);
  }

  function remove(id: string) {
    startTransition(() => deleteChecklistItem(list, id));
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</span>
      </div>
      <div className="flex flex-col gap-2.5 mb-2">
        {items.length === 0 && <p className="text-sm text-muted">{empty}</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 group">
            <span className={`mt-1 w-3.5 h-3.5 rounded-[4px] border-2 shrink-0 ${accent === "accent-brick" ? "border-brick" : "border-gold"}`} />
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
                {canEdit && (
                  <div className="hidden group-hover:flex items-center gap-2 shrink-0">
                    <button onClick={() => beginEdit(item)} className="text-muted-2 hover:text-ink">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(item.id)} className="text-muted-2 hover:text-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <>
          {showAdd ? (
            <form action={addAction} className="flex items-center gap-2 mt-1">
              <input type="hidden" name="department" value={department} />
              <input type="hidden" name="list" value={list} />
              <input
                name="text"
                placeholder="Add an item..."
                autoFocus
                className={`${inputClass} flex-1 py-1.5 text-sm`}
              />
              <button type="submit" className="text-olive shrink-0" disabled={addPending}>
                <Check size={15} />
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-muted-2 shrink-0">
                <X size={15} />
              </button>
              {addState.error && <p className="text-xs text-danger">{addState.error}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brick mt-1"
            >
              <Plus size={13} /> Add item
            </button>
          )}
        </>
      )}
    </div>
  );
}
