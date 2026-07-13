"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users, Send, Unlock, Trash2 } from "lucide-react";
import type { Department } from "@/lib/constants";
import { assignTest, assignTestToRole, assignTestToAll, unlockAssignment, unassign } from "../run-actions";

export type AssignmentRow = {
  id: string;
  staffName: string;
  department: string;
  status: string;
  attemptsUsed: number;
  bestScore: number | null;
  lastScore: number | null;
  dueAt: string | null;
  lockedAt: string | null;
};

const STATUS_TONE: Record<string, { label: string; cls: string }> = {
  assigned: { label: "Assigned", cls: "bg-paper text-charcoal-2" },
  in_progress: { label: "In progress", cls: "bg-brick-tint text-brick-dark" },
  passed: { label: "Passed", cls: "bg-[#E7F6EC] text-[#15803D]" },
  locked: { label: "Locked", cls: "bg-danger-tint text-danger" },
};

function fmtDue(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  const s = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return overdue ? `${s} (overdue)` : s;
}

const selcls = "rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";

export function AssignAndResults({ testId, passPct, assignments, staff, activeDepartments }: {
  testId: string;
  passPct: number;
  assignments: AssignmentRow[];
  staff: { id: string; full_name: string; department: string }[];
  activeDepartments: Department[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState<string>(activeDepartments[0] ?? "");

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.staffName)), [assignments]);
  const unassigned = staff.filter((s) => !assignedIds.has(s.full_name));

  function run(fn: () => Promise<{ error: string | null; assigned?: number }>, ok: (n?: number) => string) {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setErr(res.error);
      else { setMsg(ok(res.assigned)); router.refresh(); }
    });
  }

  const passed = assignments.filter((a) => a.status === "passed").length;
  const locked = assignments.filter((a) => a.status === "locked").length;

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Assign &amp; results</div>
        {assignments.length > 0 && (
          <div className="text-[13px] text-muted">{passed}/{assignments.length} passed{locked > 0 ? ` · ${locked} locked` : ""}</div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 border-b border-line pb-4">
        <div>
          <label className="text-[12px] font-semibold text-charcoal-2 block mb-1">Assign to a person</label>
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${selcls} min-w-[180px]`}>
              <option value="">Choose staff…</option>
              {unassigned.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.department}</option>)}
            </select>
            <button disabled={!pick || pending} onClick={() => run(() => assignTest(testId, [pick]), () => "Assigned & emailed.")} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"><UserPlus size={14} /> Assign</button>
          </div>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-charcoal-2 block mb-1">Assign to a role</label>
          <div className="flex gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selcls}>
              {activeDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button disabled={!role || pending} onClick={() => run(() => assignTestToRole(testId, role), (n) => `Assigned to ${n ?? 0} ${role}${n === 1 ? "" : "s"}.`)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick disabled:opacity-50"><Users size={14} /> Assign role</button>
          </div>
        </div>
        <button disabled={pending} onClick={() => { if (confirm("Send this test to all staff (matching its target roles)?")) run(() => assignTestToAll(testId), (n) => `Sent to ${n ?? 0} staff.`); }} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick disabled:opacity-50"><Send size={14} /> Send to all</button>
        {msg && <span className="text-[13px] text-olive font-semibold self-center">{msg}</span>}
        {err && <span className="text-[13px] text-danger self-center">{err}</span>}
      </div>

      {assignments.length === 0 ? (
        <p className="text-[13.5px] text-muted">No one assigned yet. Assign a person, a role, or send it to all — they&rsquo;ll get an email with a link to take it.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-line text-left">
                {["Name", "Role", "Status", "Score", "Due", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const tone = STATUS_TONE[a.status] ?? STATUS_TONE.assigned;
                const score = a.bestScore ?? a.lastScore;
                return (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink font-medium">{a.staffName}</td>
                    <td className="px-4 py-3 text-muted">{a.department}</td>
                    <td className="px-4 py-3"><span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full ${tone.cls}`}>{tone.label}</span></td>
                    <td className="px-4 py-3 tabular-nums text-ink">{score != null ? `${score}%` : "—"}{a.attemptsUsed > 0 && <span className="text-muted-2 text-[11.5px]"> · {a.attemptsUsed} try{a.attemptsUsed === 1 ? "" : "s"}</span>}</td>
                    <td className="px-4 py-3 text-muted tabular-nums">{fmtDue(a.dueAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {a.status === "locked" && (
                          <button disabled={pending} onClick={() => run(() => unlockAssignment(a.id, testId), () => "Unlocked for a retest.")} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-olive border border-olive/30 rounded-full px-2.5 py-1 hover:bg-olive-tint disabled:opacity-50"><Unlock size={12} /> Unlock</button>
                        )}
                        <button disabled={pending} onClick={() => { if (confirm(`Remove ${a.staffName} from this test?`)) run(async () => { await unassign(a.id, testId); return { error: null }; }, () => "Removed."); }} className="text-muted-2 hover:text-danger disabled:opacity-50"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {locked > 0 && <p className="text-[12.5px] text-muted-2 mt-2">Locked = used up all attempts below {passPct}%. The location&rsquo;s manager was emailed; coach them, then Unlock for a retest.</p>}
        </div>
      )}
    </div>
  );
}
