"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { NOTIFICATION_TYPES, NOTIFICATION_GROUPS, type NotificationKey } from "@/lib/notifications";
import { updateNotificationSettings } from "./notification-actions";

function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brick" : "bg-line-strong"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function NotificationSettings({ initial }: { initial: Partial<Record<NotificationKey, boolean>> }) {
  // Local mirror of the saved state; a key is ON unless explicitly false.
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    for (const n of NOTIFICATION_TYPES) s[n.key] = initial?.[n.key] !== false;
    return s;
  });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(key: NotificationKey) {
    const nextOn = !state[key];
    setState((s) => ({ ...s, [key]: nextOn }));
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await updateNotificationSettings({ [key]: nextOn });
      if (res.error) {
        setErr(res.error);
        setState((s) => ({ ...s, [key]: !nextOn })); // revert on failure
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
          <Bell size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Notifications</div>
          <p className="text-sm text-muted mt-0.5">
            Choose which automatic emails Wingman sends for your account. These apply account-wide — turning one off
            stops it for everyone at your organization. {" "}
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-2">
              {pending ? "Saving…" : saved ? <span className="text-olive font-semibold">Saved</span> : null}
            </span>
          </p>
          {err && <p className="text-[13px] text-danger mt-1">{err}</p>}
        </div>
      </div>

      {NOTIFICATION_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 mb-1.5">{group}</div>
          <div className="flex flex-col divide-y divide-line border border-line rounded-xl overflow-hidden">
            {NOTIFICATION_TYPES.filter((n) => n.group === group).map((n) => (
              <div key={n.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-medium text-ink">{n.label}</div>
                  <div className="text-[13px] text-muted leading-relaxed mt-0.5">{n.description}</div>
                  <div className="text-[12px] text-muted-2 mt-1">Goes to: {n.audience}</div>
                </div>
                <Toggle on={state[n.key]} disabled={pending} onChange={() => toggle(n.key)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[12px] text-muted-2 pt-1 border-t border-line">
        Scheduled reports have their own recipients — manage those from Reporting. Account and billing emails (like a
        failed payment) always send, so you don&rsquo;t miss something important.
      </p>
    </div>
  );
}
