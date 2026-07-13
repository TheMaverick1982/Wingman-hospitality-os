"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, User, Users, UsersRound, Check, ArrowRight, Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import type { Department } from "@/lib/constants";
import { startTests, type StartTarget } from "./tests/run-actions";

export type TestOption = {
  id: string;
  title: string;
  target_departments: string[];
  day_count: number;
  questions: number;
};

type Who = "person" | "role" | "all";

export function StartTestButton({
  tests,
  staff,
  departments,
  effectiveLocationId,
  small,
}: {
  tests: TestOption[];
  staff: { id: string; full_name: string; department: string }[];
  departments: Department[];
  effectiveLocationId?: string | null;
  small?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Who>("all");
  const [personId, setPersonId] = useState(staff[0]?.id ?? "");
  const [role, setRole] = useState<string>(departments[0] ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tests: number; assigned: number } | null>(null);
  const [pending, start] = useTransition();

  // Rough preview of how many people this reaches (server honors per-test role
  // targeting for "all", so this is a friendly upper bound, not a promise).
  const reach = useMemo(() => {
    if (who === "person") return personId ? 1 : 0;
    if (who === "role") return staff.filter((s) => s.department === role).length;
    return staff.length;
  }, [who, personId, role, staff]);

  function reset() {
    setWho("all");
    setPicked(new Set());
    setDue("");
    setError(null);
    setDone(null);
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    if (picked.size === 0) return setError("Pick at least one test to assign.");
    if (who === "person" && !personId) return setError("Choose a staff member.");
    if (who === "role" && !role) return setError("Choose a role.");
    const target: StartTarget =
      who === "person" ? { kind: "person", staffId: personId } : who === "role" ? { kind: "role", department: role } : { kind: "all" };
    const dueAt = due ? new Date(`${due}T23:59:59`).toISOString() : null;
    start(async () => {
      const res = await startTests(target, [...picked], { locationId: effectiveLocationId ?? null, dueAt });
      if (res.error) return setError(res.error);
      setDone({ tests: res.tests, assigned: res.assigned });
      router.refresh();
    });
  }

  const WHO: { key: Who; label: string; icon: typeof User }[] = [
    { key: "person", label: "One person", icon: User },
    { key: "role", label: "A role", icon: Users },
    { key: "all", label: "All staff", icon: UsersRound },
  ];

  return (
    <>
      <Btn small={small} icon={ClipboardCheck} onClick={() => { reset(); setOpen(true); }}>
        Start a test
      </Btn>
      {open && (
        <Modal
          title="Start a test"
          sub="Pick who takes it, choose the test(s), and send. Everyone gets an email with a link to begin."
          onClose={() => setOpen(false)}
        >
          {done ? (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E7F6EC] text-[#15803D] flex items-center justify-center shrink-0"><Check size={18} /></div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">Sent{done.assigned > 0 ? ` to ${done.assigned} ${done.assigned === 1 ? "person" : "people"}` : ""}.</div>
                  <p className="text-[13.5px] text-muted mt-0.5">
                    {done.tests === 1 ? "1 test" : `${done.tests} tests`} assigned. They&rsquo;ll find them under Training → Tests, and we emailed each person a link.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Btn type="button" kind="ghost" onClick={() => reset()}>Assign more</Btn>
                <Btn type="button" onClick={() => setOpen(false)}>Done</Btn>
              </div>
            </div>
          ) : tests.length === 0 ? (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-[14px] text-muted">You haven&rsquo;t built any tests yet. Build one first, then come back to assign it.</p>
              <div className="flex justify-end gap-2">
                <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark">
                  <Plus size={14} /> Build a test
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* 1 — Who */}
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">1 · Who takes it</div>
                <div className="grid grid-cols-3 gap-2">
                  {WHO.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setWho(key)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-[13px] font-semibold transition-colors ${
                        who === key ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted hover:border-line-strong"
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
                {who === "person" && (
                  <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={`${inputClass} mt-2`}>
                    {staff.length === 0 && <option value="">No staff yet</option>}
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.department}</option>)}
                  </select>
                )}
                {who === "role" && (
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClass} mt-2`}>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>

              {/* 2 — Which tests */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">2 · Which test(s)</div>
                  <Link href="/training/tests" className="text-[12.5px] font-semibold text-brick hover:text-brick-dark inline-flex items-center gap-1">
                    <Plus size={12} /> Build a new one
                  </Link>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {tests.map((t) => {
                    const on = picked.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          on ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? "bg-brick border-brick text-white" : "border-line-strong text-transparent"}`}>
                          <Check size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-ink truncate">{t.title}</span>
                          <span className="block text-[12px] text-muted">
                            {t.questions} question{t.questions === 1 ? "" : "s"}
                            {t.day_count > 1 ? ` · ${t.day_count} days` : ""}
                            {t.target_departments.length ? ` · ${t.target_departments.join(", ")}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 — When */}
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">3 · Due date <span className="text-muted-2 normal-case font-normal">(optional)</span></div>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
                <p className="text-[12px] text-muted-2 mt-1">Leave blank to use each test&rsquo;s own deadline setting.</p>
              </div>

              {error && <p className="text-[13px] text-danger">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-muted">
                  {picked.size > 0 ? `${picked.size} test${picked.size === 1 ? "" : "s"} · ` : ""}
                  {who === "person" ? "1 person" : who === "role" ? `${reach} ${role}${reach === 1 ? "" : "s"}` : `${reach} staff`}
                </span>
                <div className="flex gap-2">
                  <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                  <Btn onClick={submit} disabled={picked.size === 0} loading={pending} icon={ArrowRight}>
                    {pending ? "Sending…" : "Send test"}
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
