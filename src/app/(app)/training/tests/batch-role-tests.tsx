"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check } from "lucide-react";
import { listRolesNeedingTest, createOrUpdateTestFromRole } from "./actions";

// One-click "create a ready-to-assign test for every role." It fans out to the
// existing per-role generator ONE role at a time (so no single request hits the
// serverless timeout, and the owner sees live progress), and only ever touches
// roles that don't already have a test — an owner's customized tests are never
// overwritten. Shown only when at least one role still needs a test.
export function BatchRoleTests({ count }: { count: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(count);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"ok" | "warn">("ok");

  async function run() {
    setMsg(null);
    setRunning(true);
    setDone(0);
    const { roles, error } = await listRolesNeedingTest();
    if (error) { setMsg(error); setMsgTone("warn"); setRunning(false); return; }
    if (roles.length === 0) {
      setMsg("Every role already has a test — you're all set.");
      setMsgTone("ok");
      setRunning(false);
      router.refresh();
      return;
    }
    setTotal(roles.length);
    let made = 0;
    for (const role of roles) {
      setCurrent(role);
      const res = await createOrUpdateTestFromRole(role);
      if (res.error) {
        // A rate limit or one-off failure — stop cleanly, keep what we made.
        setMsg(
          made > 0
            ? `Created ${made} test${made === 1 ? "" : "s"}. ${res.error} Click again in a bit to finish the rest.`
            : res.error,
        );
        setMsgTone("warn");
        setCurrent(null);
        setRunning(false);
        router.refresh();
        return;
      }
      made += 1;
      setDone(made);
    }
    setCurrent(null);
    setRunning(false);
    setMsg(`Done — created ${made} ready-to-assign test${made === 1 ? "" : "s"}, one per role. Review or assign any of them below.`);
    setMsgTone("ok");
    router.refresh();
  }

  return (
    <div className="bg-brick-tint/40 border border-brick/20 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ink">
            <Sparkles size={16} className="text-brick shrink-0" />
            <span className="text-[15px] font-semibold">Set up a test for every role</span>
          </div>
          <p className="text-[13px] text-muted mt-1 max-w-xl">
            Instead of building them one at a time, Wingman can write a ready-to-assign, auto-scored test for each of your{" "}
            {total} role{total === 1 ? "" : "s"} from that role&rsquo;s own training standards. Roles that already have a
            test are left exactly as they are.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-60"
        >
          {running ? (
            <>Building{current ? ` ${current}` : ""}… {total ? `${done}/${total}` : ""}</>
          ) : (
            <><Sparkles size={14} /> Create a test for every role</>
          )}
        </button>
      </div>
      {running && total > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-white/70 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      )}
      {msg && (
        <div className={`mt-3 text-[13px] font-medium flex items-start gap-1.5 ${msgTone === "ok" ? "text-[#4d7c0f]" : "text-[#B45309]"}`}>
          {msgTone === "ok" && <Check size={15} className="shrink-0 mt-0.5" />}
          <span>{msg}</span>
        </div>
      )}
    </div>
  );
}
