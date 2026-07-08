"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, GraduationCap, ThumbsUp, MessageCircleWarning } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { updateStaffContact, updateTrainingProgress, signOffStaffTraining } from "../actions";

type ChecklistItem = { id: string; item: string };
type ProgressRow = { item_type: "standard" | "training"; item_id: string; checked: boolean; rating: "" | "strong" | "coaching"; note: string };
type Staff = {
  id: string;
  full_name: string;
  department: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  location_id: string;
  candidate_id: string | null;
  hired_on: string | null;
  created_at: string;
};
type Candidate = {
  id: string;
  name: string;
  department: string;
  occurred_on: string;
  scores: number[];
  recommendation: string;
  notes: string;
} | null;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function StaffProfileClient({
  staff,
  locationName,
  canEdit,
  hospitalityItems,
  roleItems,
  trackLabel,
  progress,
  signoffs,
  candidate,
  coreValueTitles,
}: {
  staff: Staff;
  locationName: string;
  canEdit: boolean;
  hospitalityItems: ChecklistItem[];
  roleItems: ChecklistItem[];
  trackLabel: string | null;
  progress: ProgressRow[];
  signoffs: { id: string; completion_pct: number; occurred_on: string }[];
  candidate: Candidate;
  coreValueTitles: string[];
}) {
  const [tab, setTab] = useState<"contact" | "training" | "hiring">("contact");

  const progressMap = new Map(progress.map((p) => [`${p.item_type}:${p.item_id}`, p]));
  const allItems: (ChecklistItem & { type: "standard" | "training" })[] = [
    ...hospitalityItems.map((i) => ({ ...i, type: "standard" as const })),
    ...roleItems.map((i) => ({ ...i, type: "training" as const })),
  ];
  const checkedCount = allItems.filter((i) => progressMap.get(`${i.type}:${i.id}`)?.checked).length;
  const pct = allItems.length ? Math.round((checkedCount / allItems.length) * 100) : 0;

  return (
    <>
      <Link href="/staff" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink w-fit">
        <ArrowLeft size={14} /> Back to Staff
      </Link>

      <div className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-paper text-charcoal-2 flex items-center justify-center text-lg font-semibold shrink-0">
          {initialsOf(staff.full_name)}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{staff.full_name}</h1>
            <Pill tone={staff.status === "active" ? "olive" : "muted"} dot>
              {staff.status === "active" ? "Active" : "Inactive"}
            </Pill>
          </div>
          <p className="text-sm text-muted mt-0.5">
            {staff.department} · {locationName}
            {staff.candidate_id && " · Hired through Wingman"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(["contact", "training", "hiring"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? "border-brick text-brick" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "hiring" ? "Hiring history" : t}
          </button>
        ))}
      </div>

      {tab === "contact" && <ContactTab staff={staff} locationName={locationName} canEdit={canEdit} />}

      {tab === "training" && (
        <TrainingTab
          staff={staff}
          hospitalityItems={hospitalityItems}
          roleItems={roleItems}
          trackLabel={trackLabel}
          progressMap={progressMap}
          signoffs={signoffs}
          canEdit={canEdit}
          pct={pct}
        />
      )}

      {tab === "hiring" && <HiringTab candidate={candidate} coreValueTitles={coreValueTitles} />}
    </>
  );
}

function ContactTab({ staff, locationName, canEdit }: { staff: Staff; locationName: string; canEdit: boolean }) {
  const [fullName, setFullName] = useState(staff.full_name);
  const [email, setEmail] = useState(staff.email);
  const [phone, setPhone] = useState(staff.phone);
  const [, startTransition] = useTransition();

  function save(patch: Parameters<typeof updateStaffContact>[1]) {
    startTransition(() => updateStaffContact(staff.id, patch));
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm max-w-lg">
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => save({ fullName })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => save({ email })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => save({ phone })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Role</label>
          <input value={staff.department} disabled className={inputClass} />
        </div>
        <div>
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Location</label>
          <input value={locationName} disabled className={inputClass} />
        </div>
        {canEdit && (
          <div>
            <label className="text-[13px] font-semibold mb-1.5 text-ink block">Status</label>
            <select
              defaultValue={staff.status}
              onChange={(e) => save({ status: e.target.value as "active" | "inactive" })}
              className={inputClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingTab({
  staff,
  hospitalityItems,
  roleItems,
  trackLabel,
  progressMap,
  signoffs,
  canEdit,
  pct,
}: {
  staff: Staff;
  hospitalityItems: ChecklistItem[];
  roleItems: ChecklistItem[];
  trackLabel: string | null;
  progressMap: Map<string, ProgressRow>;
  signoffs: { id: string; completion_pct: number; occurred_on: string }[];
  canEdit: boolean;
  pct: number;
}) {
  const [, startTransition] = useTransition();

  function signOff() {
    startTransition(() => signOffStaffTraining(staff.id, staff.full_name, staff.department, pct));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <span className="font-mono text-sm font-semibold text-ink">{pct}% complete</span>
          {canEdit && (
            <Btn small disabled={pct !== 100} onClick={signOff}>
              {pct === 100 ? "Log sign-off" : `Complete all items to sign off (${pct}%)`}
            </Btn>
          )}
        </div>

        <TrainingGroup
          icon={<Heart size={14} className="text-brick" />}
          label="Hospitality & guest experience"
          labelClass="text-brick"
          items={hospitalityItems}
          itemType="standard"
          staffId={staff.id}
          progressMap={progressMap}
          canEdit={canEdit}
        />

        {roleItems.length > 0 && (
          <div className="pt-5 border-t border-line">
            <TrainingGroup
              icon={<GraduationCap size={14} className="text-gold" />}
              label={`${trackLabel || "Role-specific"}`}
              labelClass="text-[#b45309]"
              items={roleItems}
              itemType="training"
              staffId={staff.id}
              progressMap={progressMap}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>

      {signoffs.length > 0 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#F1F1F1] text-sm font-semibold text-ink">Sign-off history</div>
          <div className="divide-y divide-[#F5F5F5]">
            {signoffs.map((s) => (
              <div key={s.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <span className="text-muted">{s.occurred_on}</span>
                <Pill tone={s.completion_pct >= 100 ? "olive" : "gold"}>{s.completion_pct}%</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingGroup({
  icon,
  label,
  labelClass,
  items,
  itemType,
  staffId,
  progressMap,
  canEdit,
}: {
  icon: React.ReactNode;
  label: string;
  labelClass: string;
  items: ChecklistItem[];
  itemType: "standard" | "training";
  staffId: string;
  progressMap: Map<string, ProgressRow>;
  canEdit: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-sm text-muted">No items defined yet.</p>}
        {items.map((item) => (
          <TrainingItemRow
            key={item.id}
            item={item}
            itemType={itemType}
            staffId={staffId}
            row={progressMap.get(`${itemType}:${item.id}`)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingItemRow({
  item,
  itemType,
  staffId,
  row,
  canEdit,
}: {
  item: ChecklistItem;
  itemType: "standard" | "training";
  staffId: string;
  row: ProgressRow | undefined;
  canEdit: boolean;
}) {
  const [checked, setChecked] = useState(row?.checked ?? false);
  const [rating, setRating] = useState<"" | "strong" | "coaching">(row?.rating ?? "");
  const [note, setNote] = useState(row?.note ?? "");
  const [, startTransition] = useTransition();

  function toggleChecked() {
    const next = !checked;
    setChecked(next);
    startTransition(() => updateTrainingProgress(staffId, itemType, item.id, { checked: next }));
  }

  function toggleRating(value: "strong" | "coaching") {
    const next = rating === value ? "" : value;
    setRating(next);
    startTransition(() => updateTrainingProgress(staffId, itemType, item.id, { rating: next }));
  }

  function saveNote() {
    startTransition(() => updateTrainingProgress(staffId, itemType, item.id, { note }));
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-3.5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={toggleChecked}
          disabled={!canEdit}
          className="mt-1 accent-brick shrink-0"
        />
        <span className={`text-sm leading-relaxed flex-1 ${checked ? "text-muted line-through" : "text-charcoal-2"}`}>
          {item.item}
        </span>
        {canEdit && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => toggleRating("strong")}
              className={`p-1.5 rounded-full transition-colors ${rating === "strong" ? "bg-olive-tint text-[#15803d]" : "text-muted-2 hover:bg-paper"}`}
              title="Strong"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              onClick={() => toggleRating("coaching")}
              className={`p-1.5 rounded-full transition-colors ${rating === "coaching" ? "bg-gold-tint text-[#b45309]" : "text-muted-2 hover:bg-paper"}`}
              title="Needs coaching"
            >
              <MessageCircleWarning size={14} />
            </button>
          </div>
        )}
      </div>
      {canEdit && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="Add a note..."
          className="w-full mt-2 ml-7 text-xs bg-transparent border-0 border-b border-transparent focus:border-line-strong outline-none py-1 text-muted placeholder:text-muted-2"
        />
      )}
      {!canEdit && note && <p className="text-xs text-muted mt-2 ml-7">{note}</p>}
    </div>
  );
}

function HiringTab({ candidate, coreValueTitles }: { candidate: Candidate; coreValueTitles: string[] }) {
  if (!candidate) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm text-muted">
          This person isn&apos;t linked to a hiring record — add them from a candidate scorecard in Hiring to see it here.
        </p>
      </div>
    );
  }

  const avg = candidate.scores.reduce((a, b) => a + b, 0) / (candidate.scores.length || 1);

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm max-w-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted">Scored {candidate.occurred_on}</span>
        <Pill tone={candidate.recommendation === "Strong fit" ? "olive" : candidate.recommendation === "Not a fit" ? "danger" : "gold"}>
          {candidate.recommendation}
        </Pill>
      </div>
      <div className="text-2xl font-semibold text-ink mb-5">{avg.toFixed(1)} / 5 avg</div>
      <div className="flex flex-col gap-4 mb-5">
        {coreValueTitles.map((title, i) => (
          <div key={title}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-medium text-ink">{title}</span>
              <span className="text-[13px] font-semibold text-muted tabular-nums">{candidate.scores[i] ?? 0}/5</span>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((n) => (
                <span key={n} className={`flex-1 h-1.5 rounded-full ${n < (candidate.scores[i] ?? 0) ? "bg-brick" : "bg-line"}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {candidate.notes && (
        <div className="pt-4 border-t border-line">
          <p className="text-xs font-semibold text-charcoal-2 mb-1">Interview notes</p>
          <p className="text-sm text-muted">{candidate.notes}</p>
        </div>
      )}
    </div>
  );
}
