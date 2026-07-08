import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { CreditCard, Lock } from "lucide-react";
import { InviteTeamMemberButton } from "./invite-form";
import { BulkInviteButton } from "./bulk-invite-form";
import { TeamMemberRow, type TeamMember } from "./team-member-row";
import { AddLocationForm } from "./add-location-form";
import { PermissionsMatrixForm } from "./permissions-matrix-form";
import { SettingsTabs } from "./tabs";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: members }, locations] = await Promise.all([
    supabase.from("profiles").select("id, full_name, access_role, location_id").order("full_name"),
    getOrgLocations(),
  ]);

  const allMembers = members ?? [];
  const staffCountByLocation = new Map<string, number>();
  for (const m of allMembers) {
    if (!m.location_id) continue;
    staffCountByLocation.set(m.location_id, (staffCountByLocation.get(m.location_id) ?? 0) + 1);
  }
  const monthlyTotal = locations.length > 0 ? 199 + (locations.length - 1) * 100 : 0;

  const teamContent = (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
          <div>
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Team members</span>
            <span className="text-[13px] text-muted-2 ml-1.5">{allMembers.length} users</span>
          </div>
          <div className="flex items-center gap-2">
            <BulkInviteButton locations={locations} />
            <InviteTeamMemberButton locations={locations} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAFAFA] text-left">
              {["Name", "Access level", "Location", ""].map((h) => (
                <th key={h} className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allMembers.map((m) => (
              <TeamMemberRow key={m.id} member={m as TeamMember} locations={locations} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Permissions by level</div>
        <p className="text-sm text-muted mb-5">
          What each access level can see and do. Super Admin is the account owner and always has full access — only
          Manager and Staff levels are editable here.
        </p>
        <PermissionsMatrixForm initialOverrides={profile.permissionOverrides} />
      </div>
    </div>
  );

  const locationsContent = (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
          <div>
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Locations</span>
            <span className="text-[13px] text-muted-2 ml-1.5">{locations.length} active</span>
          </div>
          <AddLocationForm currentLocationCount={locations.length} />
        </div>
        {locations.map((l, i) => (
          <div key={l.id} className="flex items-center justify-between px-6 py-4 border-b border-[#F5F5F5] last:border-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-10 h-10 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center text-base shrink-0">◈</span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-ink">{l.name}</div>
                {(l.address || l.phone || l.email) && (
                  <div className="text-xs text-muted-2 truncate">
                    {[l.address, l.phone, l.email].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <span className="text-[13px] text-muted">{staffCountByLocation.get(l.id) ?? 0} staff</span>
              <span className="text-[13px] font-semibold text-[#15803D] bg-[#E7F6EC] px-2.5 py-1 rounded-full">
                {i === 0 ? "$199 base" : "+$100/mo"}
              </span>
            </div>
          </div>
        ))}
      </div>
      {locations.length > 1 && (
        <div className="bg-[#0A0A0A] rounded-2xl px-7 py-6 text-white flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[15px] font-semibold">Multi-location plan</div>
            <div className="text-[13px] text-[#A1A1A1] mt-0.5">
              $199 first location + $100 per additional · billed monthly
            </div>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-bold tracking-[-0.02em]">
              ${monthlyTotal}
              <span className="text-[15px] text-[#A1A1A1] font-medium">/mo</span>
            </div>
            <div className="text-xs text-[#A1A1A1] mt-0.5">
              $199 + {locations.length - 1} × $100
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">
        Adding a location updates your subscription automatically once billing is connected — see the Billing tab.
      </p>
    </div>
  );

  const billingContent = (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} className="text-muted-2" />
        <h3 className="font-display text-lg font-semibold text-ink">Billing</h3>
      </div>
      <p className="text-sm text-muted mb-4">
        Payment processing isn&apos;t connected yet. Once it is, you&apos;ll manage your plan, add or
        remove locations, and cancel from here. This tab is only ever visible to the account owner.
      </p>
      <div className="flex items-center gap-2 opacity-50">
        <CreditCard size={16} className="text-muted" />
        <span className="text-sm text-muted">No payment method on file</span>
      </div>
    </div>
  );

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Settings</h1>
        <p className="text-base text-muted">Manage your team, locations, and subscription.</p>
      </div>

      <SettingsTabs team={teamContent} locations={locationsContent} billing={billingContent} />
    </>
  );
}
