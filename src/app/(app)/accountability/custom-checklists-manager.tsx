"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { ChecklistTemplateEditor } from "./checklist-template-editor";
import { createCustomChecklist, updateCustomChecklist, deleteCustomChecklist, type CustomChecklist } from "./custom-checklist-actions";
import { NETWORK_ERROR_MESSAGE } from "@/lib/network-safe-action";
import type { TemplateItem } from "./template-actions";

type ChecklistWithItems = CustomChecklist & { items: TemplateItem[] };

// Multi-select role chips. No selection = all staff.
function RolePicker({ departments, selected, onToggle }: { departments: string[]; selected: string[]; onToggle: (d: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {departments.map((d) => {
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            className={`text-[12.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
              on ? "border-brick bg-brick-tint text-brick" : "border-line text-charcoal-2 hover:border-brick/50"
            }`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// Owner UI: create checklists (assigned to one or more roles), edit their items
// (including "Build with AI"), reassign, or delete. Staff whose role is included
// get the checklist as a card they complete each shift.
export function CustomChecklistsManager({ checklists, departments }: { checklists: ChecklistWithItems[]; departments: string[] }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [depts, setDepts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (d: string) => setDepts((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  function add() {
    setError(null);
    if (!title.trim()) {
      setError("Give the checklist a name.");
      return;
    }
    start(async () => {
      try {
        const res = await createCustomChecklist(title, depts);
        if (res.error) setError(res.error);
        else {
          setTitle("");
          setDepts([]);
          setAdding(false);
        }
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">Role checklists</h3>
          <p className="text-sm text-muted">Build your own checklists and assign each to one or more roles. Everyone in those roles completes it every shift when they log in.</p>
        </div>
        {!adding && (
          <Btn small icon={Plus} onClick={() => setAdding(true)}>
            New checklist
          </Btn>
        )}
      </div>

      {adding && (
        <div className="bg-white border border-brick/40 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div>
            <label className="text-[13px] font-semibold text-charcoal-2 mb-1 block">Checklist name</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bartender opening checklist" className={inputClass} autoFocus />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-charcoal-2 mb-1.5 block">
              Assign to roles <span className="text-muted-2 font-normal">— none selected = all staff</span>
            </label>
            <RolePicker departments={departments} selected={depts} onToggle={toggle} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => { setAdding(false); setError(null); }}>
              Cancel
            </Btn>
            <Btn onClick={add} disabled={pending}>
              {pending ? "Creating…" : "Create checklist"}
            </Btn>
          </div>
        </div>
      )}

      {checklists.length === 0 && !adding ? (
        <p className="text-sm text-muted-2">No role checklists yet. Create one and assign it to a role — or build it with AI once it exists.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {checklists.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <ChecklistHeader checklist={c} departments={departments} />
              <ChecklistTemplateEditor checklistType={c.id} title={c.title} items={c.items} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistHeader({ checklist, departments }: { checklist: ChecklistWithItems; departments: string[] }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(checklist.title);
  const [depts, setDepts] = useState<string[]>(checklist.departments ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (d: string) => setDepts((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  function save() {
    setError(null);
    start(async () => {
      try {
        const res = await updateCustomChecklist(checklist.id, title, depts);
        if (res?.error) setError(res.error);
        else setEditing(false);
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  }
  function remove() {
    if (!confirm(`Delete "${checklist.title}"? This removes the checklist and its items.`)) return;
    start(async () => {
      try {
        await deleteCustomChecklist(checklist.id);
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 bg-paper border border-line rounded-xl p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} py-1.5 text-sm`} />
        <RolePicker departments={departments} selected={depts} onToggle={toggle} />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn small kind="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          <Btn small onClick={save} disabled={pending}>
            Save
          </Btn>
        </div>
      </div>
    );
  }

  const label = checklist.departments && checklist.departments.length > 0 ? checklist.departments.join(", ") : "All staff";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-2 bg-paper border border-line rounded-full px-2.5 py-1">
        <Users size={12} /> {label}
      </span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold text-muted-2 hover:text-brick">
          Rename / reassign
        </button>
        <button type="button" onClick={remove} disabled={pending} className="text-muted-2 hover:text-danger" aria-label="Delete checklist">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
