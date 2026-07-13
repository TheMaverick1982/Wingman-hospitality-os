"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { hireCandidate } from "./actions";

// "Hire" a scored candidate into Staff — and optionally fire the account-setup
// email so they can log in. Candidates carry no email, so we collect it (+ phone
// + access level) here at the moment of hire.
export function HireCandidateButton({
  candidateId,
  alreadyHired,
  canInvite,
}: {
  candidateId: string;
  alreadyHired: boolean;
  canInvite: boolean;
}) {
  const [done, setDone] = useState(alreadyHired);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accessRole, setAccessRole] = useState<"staff" | "manager" | "super_admin">("staff");
  const [sendInvite, setSendInvite] = useState(canInvite);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <Pill tone="olive">
        <Check size={11} /> On staff
      </Pill>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await hireCandidate(candidateId, { email, phone, accessRole, sendInvite: sendInvite && canInvite });
      if (res.error) {
        setError(res.error);
        // A partial success (hired but invite failed) still flips the state.
        if (res.staffId) {
          setDone(true);
          router.refresh();
        }
        return;
      }
      setDone(true);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-brick hover:underline"
      >
        <UserPlus size={13} /> Hire
      </button>
      {open && (
        <Modal title="Hire this candidate" sub="Add them to your staff — and send a login so they can start using Wingman." onClose={() => setOpen(false)}>
          <Field label="Email (their login)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Access level">
            <select value={accessRole} onChange={(e) => setAccessRole(e.target.value as typeof accessRole)} className={inputClass}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="super_admin">Super Admin (co-owner)</option>
            </select>
          </Field>

          {canInvite ? (
            <label className="flex items-start gap-2.5 mt-1 mb-2 cursor-pointer">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="accent-brick mt-0.5" />
              <span className="text-[13px] text-charcoal-2">
                Email them a login invite now <span className="text-muted-2">— they&rsquo;ll set a password and can enter guest bounce-backs, see their training, and more.</span>
              </span>
            </label>
          ) : (
            <p className="text-[12px] text-muted-2 mb-2">
              Adds them to staff. Only an owner can send the login invite — they can do it from Settings → Team.
            </p>
          )}

          {error && <p className="text-sm text-danger mb-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setOpen(false)} className="text-[13.5px] font-semibold text-muted hover:text-ink px-4 py-2.5">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending || (sendInvite && canInvite && !email.trim())}
              className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {pending ? <><Loader2 size={14} className="animate-spin" /> Hiring…</> : sendInvite && canInvite ? "Hire & send login" : "Add to staff"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
