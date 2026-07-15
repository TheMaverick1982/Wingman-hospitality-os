"use client";

import { useActionState, useState, useTransition } from "react";
import { Building2, Plus, X, Check } from "lucide-react";
import {
  createFranchiseGroup,
  addFranchiseMember,
  removeFranchiseMember,
  addFranchiseAdmin,
  removeFranchiseAdmin,
  type FranchiseActionState,
} from "./actions";

export type GroupView = {
  id: string;
  name: string;
  billingMode: string;
  members: { orgId: string; name: string }[];
  admins: { userId: string; name: string; role: string }[];
};
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

  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-[17px] font-semibold text-ink">{group.name}</h3>
          <div className="text-[12.5px] text-muted-2">
            {group.billingMode === "central" ? "Franchisor pays for all" : "Each franchisee pays their own"}
          </div>
        </div>
      </div>

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
              <option value="">Grant oversight to…</option>
              {addableAdmins.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.orgName ? ` · ${a.orgName}` : ""}</option>
              ))}
            </select>
            <button type="button" disabled={pending || !adminPick} onClick={() => { if (adminPick) run(() => addFranchiseAdmin(group.id, adminPick, "admin")); setAdminPick(""); }} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark disabled:opacity-50">Add</button>
          </div>
        </div>
      </div>
      {err && <p className="text-[13px] text-danger mt-3">{err}</p>}
    </div>
  );
}
