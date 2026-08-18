"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Heart, GraduationCap, ThumbsUp, MessageCircleWarning, ClipboardList, ClipboardCheck, CheckCircle2, Lock } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { updateStaffContact, updateTrainingProgress, signOffStaffTraining, setStaffSurveyExcluded, updateStaffRoles } from "../actions";

type ChecklistItem = { id: string; item: string };
type ProgressRow = { item_type: "standard" | "training"; item_id: string; checked: boolean; rating: "" | "strong" | "coaching"; note: string };
type Staff = {
  id: string;
  full_name: string;
  department: string;
  additional_departments?: string[];
  email: string;
  phone: string;
  status: "active" | "inactive";
  location_id: string;
  exclude_from_survey?: boolean;
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

type TestRow = { testId: string; title: string; status: string; score: number | null; passPct: number; day: number; dayCount: number; due: string | null };
type ChecklistSummary = { count: number; last: string | null };
type Checklists = { hasLogin: boolean; preshift: ChecklistSummary; loyalty: ChecklistSummary };

type Tab = "activity" | "contact" | "training" | "tests" | "hiring";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function StaffProfileClient({
  staff,
  departments,
  locationName,
  canEdit,
  accountEmail,
  hospitalityItems,
  roleItems,
  trackLabel,
  progress,
  signoffs,
  candidate,
  coreValueTitles,
  tests,
  checklists,
  initialTab,
}: {
  staff: Staff;
  departments: string[];
  locationName: string;
  canEdit: boolean;
  accountEmail?: string | null;
  hospitalityItems: ChecklistItem[];
  roleItems: ChecklistItem[];
  trackLabel: string | null;
  progress: ProgressRow[];
  signoffs: { id: string; completion_pct: number; occurred_on: string }[];
  candidate: Candidate;
  coreValueTitles: string[];
  tests: TestRow[];
  checklists: Checklists;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "activity");

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
            {[staff.department, ...(staff.additional_departments ?? [])].join(" · ")} · {locationName}
            {staff.candidate_id && " · Hired through Wingman"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {(["activity", "contact", "training", "tests", "hiring"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize -mb-px border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? "border-brick text-brick" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "hiring" ? "Hiring history" : t}
          </button>
        ))}
      </div>

      {tab === "activity" && (
        <ActivityTab
          tests={tests}
          checklists={checklists}
          trainingPct={pct}
          trainingItemCount={allItems.length}
          lastSignoff={signoffs[0] ?? null}
          candidate={candidate}
          onGoTo={setTab}
        />
      )}

      {tab === "contact" && <ContactTab staff={staff} departments={departments} locationName={locationName} canEdit={canEdit} accountEmail={accountEmail} />}

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

      {tab === "tests" && <TestsTab tests={tests} />}

      {tab === "hiring" && <HiringTab candidate={candidate} coreValueTitles={coreValueTitles} />}
    </>
  );
}

const TEST_TONE: Record<string, { label: string; cls: string }> = {
  assigned: { label: "Not started", cls: "bg-paper text-charcoal-2" },
  in_progress: { label: "In progress", cls: "bg-brick-tint text-brick-dark" },
  passed: { label: "Passed", cls: "bg-[#E7F6EC] text-[#15803D]" },
  locked: { label: "Locked", cls: "bg-danger-tint text-danger" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// One place to see everything a person touches: tests, personal checklists, and
// a quick read on training and hiring (which have their own detailed tabs).
function ActivityTab({
  tests,
  checklists,
  trainingPct,
  trainingItemCount,
  lastSignoff,
  candidate,
  onGoTo,
}: {
  tests: TestRow[];
  checklists: Checklists;
  trainingPct: number;
  trainingItemCount: number;
  lastSignoff: { completion_pct: number; occurred_on: string } | null;
  candidate: Candidate;
  onGoTo: (t: Tab) => void;
}) {
  const passed = tests.filter((t) => t.status === "passed").length;
  const hiringAvg = candidate ? candidate.scores.reduce((a, b) => a + b, 0) / (candidate.scores.length || 1) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Quick summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => onGoTo("training")} className="text-left bg-white border border-line rounded-2xl p-5 shadow-sm hover:border-brick transition-colors">
          <div className="flex items-center gap-2 text-muted mb-2"><GraduationCap size={15} /> <span className="text-[12.5px] font-semibold uppercase tracking-wide">Training</span></div>
          <div className="text-[22px] font-bold text-ink">{trainingItemCount > 0 ? `${trainingPct}%` : "—"}</div>
          <div className="text-[12.5px] text-muted mt-0.5">{lastSignoff ? `Last signed off ${fmtDate(lastSignoff.occurred_on)}` : "No sign-off yet"}</div>
        </button>
        <button onClick={() => onGoTo("tests")} className="text-left bg-white border border-line rounded-2xl p-5 shadow-sm hover:border-brick transition-colors">
          <div className="flex items-center gap-2 text-muted mb-2"><ClipboardList size={15} /> <span className="text-[12.5px] font-semibold uppercase tracking-wide">Tests</span></div>
          <div className="text-[22px] font-bold text-ink">{tests.length > 0 ? `${passed}/${tests.length}` : "—"}</div>
          <div className="text-[12.5px] text-muted mt-0.5">{tests.length > 0 ? "passed" : "None assigned"}</div>
        </button>
        <button onClick={() => onGoTo("hiring")} className="text-left bg-white border border-line rounded-2xl p-5 shadow-sm hover:border-brick transition-colors">
          <div className="flex items-center gap-2 text-muted mb-2"><ThumbsUp size={15} /> <span className="text-[12.5px] font-semibold uppercase tracking-wide">Hiring</span></div>
          <div className="text-[22px] font-bold text-ink">{hiringAvg != null ? `${hiringAvg.toFixed(1)}/5` : "—"}</div>
          <div className="text-[12.5px] text-muted mt-0.5">{candidate ? candidate.recommendation : "Not hired through Wingman"}</div>
        </button>
      </div>

      {/* Tests detail */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F1F1] flex items-center gap-2">
          <ClipboardList size={16} className="text-brick" />
          <span className="text-[15px] font-semibold text-ink">Tests</span>
        </div>
        {tests.length > 0 ? (
          <div className="divide-y divide-[#F5F5F5]">
            {tests.map((t, i) => {
              const tone = TEST_TONE[t.status] ?? TEST_TONE.assigned;
              return (
                <div key={i} className="px-6 py-3 flex items-center gap-3">
                  {t.status === "passed" ? <CheckCircle2 size={15} className="text-[#15803d] shrink-0" /> : t.status === "locked" ? <Lock size={15} className="text-danger shrink-0" /> : <ClipboardList size={15} className="text-muted-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-ink truncate">{t.title}</div>
                    <div className="text-[12px] text-muted">
                      Day {Math.min(t.day, t.dayCount)} of {t.dayCount}
                      {t.score != null ? ` · ${t.score}% (pass ${t.passPct}%)` : ""}
                      {t.due ? ` · due ${fmtDate(t.due)}` : ""}
                    </div>
                  </div>
                  <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full ${tone.cls}`}>{tone.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-5 text-sm text-muted">No tests assigned yet. Assign one from Training → Start a test.</p>
        )}
      </div>

      {/* Checklists */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F1F1] flex items-center gap-2">
          <ClipboardCheck size={16} className="text-brick" />
          <span className="text-[15px] font-semibold text-ink">Checklists · last 30 days</span>
        </div>
        {checklists.hasLogin ? (
          <div className="divide-y divide-[#F5F5F5]">
            {([["Pre-shift", checklists.preshift], ["FOH loyalty", checklists.loyalty]] as const).map(([label, s]) => (
              <div key={label} className="px-6 py-3 flex items-center justify-between text-sm">
                <span className="text-ink">{label}</span>
                <span className="text-[13px] text-muted tabular-nums">
                  {s.count} completed{s.last ? ` · last ${fmtDate(s.last)}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-5 text-sm text-muted">No login linked yet — checklist completions appear once this person can sign in.</p>
        )}
      </div>
    </div>
  );
}

// Tests this person has: what they still need to take, and what they've done
// (with status + score). Each is clickable through to the test's results.
function TestsTab({ tests }: { tests: TestRow[] }) {
  const toTake = tests.filter((t) => t.status !== "passed" && t.status !== "locked");
  const done = tests.filter((t) => t.status === "passed" || t.status === "locked");

  function Row({ t }: { t: TestRow }) {
    const tone = TEST_TONE[t.status] ?? TEST_TONE.assigned;
    return (
      <Link href={`/training/tests/${t.testId}/assign`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
        {t.status === "passed" ? <CheckCircle2 size={16} className="text-[#15803d] shrink-0" /> : t.status === "locked" ? <Lock size={16} className="text-danger shrink-0" /> : <ClipboardList size={16} className="text-muted-2 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-ink truncate">{t.title}</div>
          <div className="text-[12.5px] text-muted">
            Day {Math.min(t.day, t.dayCount)} of {t.dayCount}
            {t.score != null ? ` · ${t.score}% (pass ${t.passPct}%)` : ""}
            {t.due ? ` · due ${fmtDate(t.due)}` : ""}
          </div>
        </div>
        <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${tone.cls}`}>{tone.label}</span>
        <ArrowRight size={15} className="text-muted-2 shrink-0" />
      </Link>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
        <ClipboardList size={22} className="mx-auto text-muted-2 mb-2" />
        <p className="text-sm text-muted">No tests assigned yet. Assign one from Training → Start a test.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F1F1] flex items-center gap-2">
          <ClipboardList size={16} className="text-brick" />
          <span className="text-[15px] font-semibold text-ink">Still to take</span>
          <span className="text-[13px] text-muted">· {toTake.length}</span>
        </div>
        {toTake.length > 0 ? (
          <div className="divide-y divide-[#F5F5F5]">{toTake.map((t, i) => <Row key={i} t={t} />)}</div>
        ) : (
          <p className="px-5 py-5 text-sm text-muted">All caught up — nothing outstanding.</p>
        )}
      </div>

      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F1F1] flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#15803d]" />
          <span className="text-[15px] font-semibold text-ink">Completed</span>
          <span className="text-[13px] text-muted">· {done.length}</span>
        </div>
        {done.length > 0 ? (
          <div className="divide-y divide-[#F5F5F5]">{done.map((t, i) => <Row key={i} t={t} />)}</div>
        ) : (
          <p className="px-5 py-5 text-sm text-muted">No completed tests yet.</p>
        )}
      </div>
    </div>
  );
}

// Edit a staff member's role(s): one primary role plus any additional roles for
// people whose work overlaps (e.g. Host + Server). They see the training, menu,
// tests, and checklists for every role they hold.
function RoleEditor({
  staff,
  departments,
  canEdit,
  onSave,
}: {
  staff: Staff;
  departments: string[];
  canEdit: boolean;
  onSave: (primary: string, additional: string[]) => void;
}) {
  const [primary, setPrimary] = useState(staff.department);
  const [additional, setAdditional] = useState<string[]>(staff.additional_departments ?? []);

  // Offer every role the restaurant runs, plus any the person already holds (so
  // a staff-only role isn't dropped from the list).
  const options = Array.from(new Set([...departments, staff.department, ...(staff.additional_departments ?? [])]));

  function changePrimary(next: string) {
    const nextAdditional = additional.filter((d) => d !== next);
    setPrimary(next);
    setAdditional(nextAdditional);
    onSave(next, nextAdditional);
  }

  function toggleAdditional(dept: string) {
    const next = additional.includes(dept) ? additional.filter((d) => d !== dept) : [...additional, dept];
    setAdditional(next);
    onSave(primary, next);
  }

  if (!canEdit) {
    return (
      <div>
        <label className="text-[13px] font-semibold mb-1.5 text-ink block">Role{(staff.additional_departments?.length ?? 0) > 0 ? "s" : ""}</label>
        <input value={[staff.department, ...(staff.additional_departments ?? [])].join(", ")} disabled className={inputClass} />
      </div>
    );
  }

  return (
    <div>
      <label className="text-[13px] font-semibold mb-1.5 text-ink block">Primary role</label>
      <select value={primary} onChange={(e) => changePrimary(e.target.value)} className={inputClass}>
        {options.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <div className="text-[13px] font-semibold mt-4 mb-1.5 text-ink">Additional roles</div>
      <p className="text-[12px] text-muted-2 mb-2">For people who work more than one role — they&rsquo;ll get the training, menu, tests, and checklists for each.</p>
      <div className="flex flex-wrap gap-2">
        {options.filter((d) => d !== primary).map((d) => {
          const on = additional.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleAdditional(d)}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                on ? "bg-brick text-white border-brick" : "bg-white text-charcoal-2 border-line hover:border-brick"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContactTab({ staff, departments, locationName, canEdit, accountEmail }: { staff: Staff; departments: string[]; locationName: string; canEdit: boolean; accountEmail?: string | null }) {
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
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Contact email</label>
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
          <label className="text-[13px] font-semibold mb-1.5 text-ink block">Login email</label>
          <input value={accountEmail ?? ""} placeholder="No login set up yet" disabled className={`${inputClass} opacity-70`} />
          <p className="text-[12px] text-muted-2 mt-1">
            {accountEmail
              ? "The address this person signs in with. It can differ from their contact email and is managed by them in their account."
              : "This person hasn't been invited to a login yet. Once they are, the email they sign in with shows here."}
          </p>
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
        <RoleEditor staff={staff} departments={departments} canEdit={canEdit} onSave={(primary, additional) => startTransition(() => { void updateStaffRoles(staff.id, primary, additional); })} />
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
        {canEdit && (
          <div className="pt-3 border-t border-line">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                defaultChecked={!staff.exclude_from_survey}
                onChange={(e) => startTransition(() => setStaffSurveyExcluded(staff.id, !e.target.checked))}
                className="accent-brick w-4 h-4 mt-0.5 shrink-0"
              />
              <span>
                <span className="text-[13px] font-semibold text-ink block">Show on the guest survey</span>
                <span className="text-[12px] text-muted-2">
                  Appears in the &ldquo;who took care of you?&rdquo; list. Turn off for team members who don&rsquo;t work the floor
                  (marketing, catering, back office).
                </span>
              </span>
            </label>
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
        <div className="bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
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
