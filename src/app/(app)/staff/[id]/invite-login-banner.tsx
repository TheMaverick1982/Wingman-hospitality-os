"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { inviteStaffToLogin } from "../actions";
import type { LoginAccessRole } from "@/lib/invite";

// Shown on a staff profile that has no login yet: send them a "set up your
// account" email so they can log in, choosing their access level. Owner-only.
export function InviteLoginBanner({ staffId, name, email }: { staffId: string; name: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accessRole, setAccessRole] = useState<LoginAccessRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = () =>
    start(async () => {
      setError(null);
      const res = await inviteStaffToLogin(staffId, accessRole);
      if (res.error) return setError(res.error);
      setSent(true);
      router.refresh();
    });

  if (sent) {
    return (
      <div className="bg-olive-tint border border-olive/30 rounded-2xl px-5 py-3.5 text-[13.5px] text-[#3f6212] font-medium">
        Login invite sent to {email} — {name} will get an email to set their password.
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center gap-3">
      <KeyRound size={17} className="text-brick shrink-0" />
      <div className="flex-1 min-w-[200px] text-[13.5px] text-charcoal-2">
        <span className="font-semibold text-ink">{name} doesn&rsquo;t have a login yet.</span>{" "}
        {email ? "Send a set-up email so they can enter bounce-backs and see their training." : "Add an email on the Contact tab first, then invite them to log in."}
      </div>
      {email && (
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={accessRole}
            onChange={(e) => setAccessRole(e.target.value as LoginAccessRole)}
            className="text-[13px] border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brick"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button
            onClick={send}
            disabled={pending}
            className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {pending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : "Invite to log in"}
          </button>
        </div>
      )}
      {error && <p className="w-full text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
