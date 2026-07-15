"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Building2, Plus, X, UserPlus, Mail } from "lucide-react";
import {
  createFranchiseGroup,
  addFranchiseMember,
  removeFranchiseMember,
  addFranchiseAdmin,
  removeFranchiseAdmin,
  changeGroupBillingMode,
  inviteFranchisor,
  type FranchiseActionState,
} from "./actions";

export type GroupView = {
  id: string;
  name: string;
  billingMode: string;
  members: { orgId: string; name: string }[];
  admins: { userId: string; name: string; role: string }[];
  totalMonthlyCents: number;
  ownerHasCard: boolean;
};

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export type OrgOption = { id: string; name: string; inGroup: string | null };
export type AdminOption = { id: string; name: string; orgName: string };

const initial: FranchiseActionState = { error: null };

export function FranchiseAdminClient({ groups, orgOptions, adminOptions }: { groups: GroupView[]; orgOptions: OrgOption[]; adminOptions: AdminOption[] }) {
  const [createState, createAction, creating] = useActionState(createFranchiseGroup, initial);

  return (
    <div className="flex flex-col gap-6">
      {/* Create group */}
      <div className="bg-white border border-line rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={17} className="text-brick" />
          <h2 className="text-[17px] font-semibold text-ink">New franchise group</h2>
        </div>
        <form action={createAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1">Group name</label>
            <input name="name" placeholder="e.g. Taco Loco Franchising" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick w-72" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1">Billing</label>
            <select name="billing_mode" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick">
              <option value="distributed">Each franchisee pays their own</option>
              <option value="central">Franchisor pays for all</option>
            </select>
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50">
            <Plus size={15} /> {creating ? "Creating…" : "Create group"}
          </button>
          {createState.error && <span className="text-[13px] text-danger">{createState.error}</span>}
        </form>
      </div>

      {groups.length === 0 ? (
        <div className="text-sm text-muted-2">No franchise groups yet.</div>
      ) : (
        groups.map((g) => <GroupCard key={g.id} group={g} orgOptions={orgOptions} adminOptions={adminOptions} />)
      )}
    </div>
  );
}

function GroupCard({ group, orgOptions, adminOptions }: { group: GroupView; orgOptions: OrgOption[]; adminOptions: AdminOption[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [orgPick, setOrgPick] = useState("");
  const [adminPick, setAdminPick] = useState("");
  const memberIds = new Set(group.members.map((m) => m.orgId));
  const adminIds = new Set(group.admins.map((a) => a.userId));

  const run = (fn: () => Promise<FranchiseActionState>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
    });
  };

  const addableOrgs = orgOptions.filter((o) => !memberIds.has(o.id));
  const addableAdmins = adminOptions.filter((a) => !adminIds.has(a.id));

  const isCentral = group.billingMode === "central";

  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-[17px] font-semibold text-ink">{group.name}</h3>
          <div className="text-[12.5px] text-muted-2">
            {isCentral ? "Franchisor pays for all (one rolled-up charge)" : "Each franchisee pays their own"}
          </div>
        </div>
        {/* Billing model + group total */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2">
              {isCentral ? "Group monthly" : "Combined MRR"}
            </div>
            <div className="text-[18px] font-bold text-ink tabular-nums leading-tight">{money(group.totalMonthlyCents)}<span className="text-[12px] font-medium text-muted-2">/mo</span></div>
          </div>
          <select
            value={group.billingMode === "central" ? "central" : "distributed"}
            disabled={pending}
            onChange={(e) => run(() => changeGroupBillingMode(group.id, e.target.value === "central" ? "central" : "distributed"))}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brick disabled:opacity-50"
            aria-label="Billing model"
          >
            <option value="distributed">Each franchisee pays</option>
            <option value="central">Franchisor pays all</option>
          </select>
        </div>
      </div>
      {isCentral && !group.ownerHasCard && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#F0D9A8] bg-gold-tint px-3 py-2 text-[12.5px] text-[#8a5a00]">
          <span>⚠︎ No card on file for the franchisor. The monthly roll-up charge can&apos;t run until they add a payment method (their org&apos;s Settings → Billing).</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Franchisees */}
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-2">Franchisees ({group.members.length})</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {group.members.length === 0 && <div className="text-[13px] text-muted-2">None attached yet.</div>}
            {group.members.map((m) => (
              <div key={m.orgId} className="flex items-center justify-between gap-2 bg-paper rounded-lg px-3 py-2">
                <span className="text-[13.5px] text-ink truncate">{m.name}</span>
                <button type="button" disabled={pending} onClick={() => run(() => removeFranchiseMember(group.id, m.orgId))} className="text-muted-2 hover:text-danger disabled:opacity-50" aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={orgPick} onChange={(e) => setOrgPick(e.target.value)} className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick">
              <option value="">Add a franchisee…</option>
              {addableOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.inGroup && o.inGroup !== group.id ? " (moving from another group)" : ""}</option>
              ))}
            </select>
            <button type="button" disabled={pending || !orgPick} onClick={() => { if (orgPick) run(() => addFranchiseMember(group.id, orgPick)); setOrgPick(""); }} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark disabled:opacity-50">Add</button>
          </div>
        </div>

        {/* Franchisor admins */}
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-2">Franchisor admins ({group.admins.length})</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {group.admins.length === 0 && <div className="text-[13px] text-muted-2">No one has oversight yet.</div>}
            {group.admins.map((a) => (
              <div key={a.userId} className="flex items-center justify-between gap-2 bg-paper rounded-lg px-3 py-2">
                <span className="text-[13.5px] text-ink truncate">{a.name} <span className="text-muted-2">· {a.role}</span></span>
                <button type="button" disabled={pending} onClick={() => run(() => removeFranchiseAdmin(group.id, a.userId))} className="text-muted-2 hover:text-danger disabled:opacity-50" aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={adminPick} onChange={(e) => setAdminPick(e.target.value)} className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick">
              <option value="">Grant oversight to an existing user…</option>
              {addableAdmins.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.orgName ? ` · ${a.orgName}` : ""}</option>
              ))}
            </select>
            <button type="button" disabled={pending || !adminPick} onClick={() => { if (adminPick) run(() => addFranchiseAdmin(group.id, adminPick, "admin")); setAdminPick(""); }} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark disabled:opacity-50">Add</button>
          </div>

          {/* Invite a brand-new franchisor (no existing account) */}
          <InviteFranchisor groupId={group.id} />
        </div>
      </div>
      {err && <p className="text-[13px] text-danger mt-3">{err}</p>}
    </div>
  );
}

// Provision a franchisor who has no Wingman account yet — creates a comp HQ org +
// login and emails them a set-password invite, in one step.
function InviteFranchisor({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setSent(false); }} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick hover:text-brick-dark">
        <UserPlus size={13} /> Invite a new franchisor (no account yet)
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        setErr(null);
        start(async () => {
          const r = await inviteFranchisor(groupId, fd);
          if (r.error) setErr(r.error);
          else { setSent(true); formRef.current?.reset(); }
        });
      }}
      className="mt-3 rounded-xl border border-line bg-paper p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2">Invite a new franchisor</span>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-2 hover:text-danger" aria-label="Close"><X size={14} /></button>
      </div>
      <input name="name" required placeholder="Franchisor's name" className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick" />
      <input name="email" type="email" required placeholder="Email for their login" className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick" />
      <input name="brand" placeholder="Brand / HQ name (optional)" className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick" />
      <label className="flex items-start gap-2 text-[12.5px] text-ink cursor-pointer">
        <input name="corporate" type="checkbox" className="mt-0.5 accent-brick" />
        <span>Also runs <strong>corporate-owned locations</strong> they&apos;ll pay for — makes the HQ a paying account that bills per-location (like a franchisee), on top of any franchisee roll-up.</span>
      </label>
      <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark disabled:opacity-50">
        <Mail size={13} /> {pending ? "Sending invite…" : "Create HQ + send invite"}
      </button>
      <p className="text-[11.5px] text-muted-2 leading-snug">
        Creates a brand-HQ account, makes them the group&apos;s billing owner, and emails a set-password link — no license purchase required.
      </p>
      {err && <p className="text-[12.5px] text-danger">{err}</p>}
      {sent && !err && <p className="text-[12.5px] text-[#15803d] font-medium">Invite sent. They&apos;ll appear as an admin above.</p>}
    </form>
  );
}
