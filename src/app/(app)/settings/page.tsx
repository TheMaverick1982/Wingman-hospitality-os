import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgLocations } from "@/lib/data/locations";
import { getActiveDepartments } from "@/lib/roles";
import { getPlatformPricing } from "@/lib/pricing";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import type { NotificationKey } from "@/lib/notifications";
import { CreditCard, Gift, Lock } from "lucide-react";
import { InviteTeamMemberButton } from "./invite-form";
import { BulkInviteButton } from "./bulk-invite-form";
import { TeamMemberRow, type TeamMember } from "./team-member-row";
import { AddLocationForm } from "./add-location-form";
import { DeleteLocationButton } from "./delete-location-button";
import { EditLocationForm } from "./edit-location-form";
import { PermissionsMatrixForm } from "./permissions-matrix-form";
import { SettingsTabs } from "./tabs";
import { NotificationSettings } from "./notification-settings";
import { ApiKeysManager } from "./api-keys-manager";
import type { ApiKeyRow } from "./api-actions";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  // Owners get the full Settings surface; managers (and shift leads) get in for
  // the Notifications section only.
  if (!isManagerOrAbove(profile.accessRole)) redirect("/dashboard");
  const isOwner = profile.accessRole === "super_admin";

  const admin0 = createAdminClient();
  const { data: orgNotif } = await admin0
    .from("organizations")
    .select("notification_settings")
    .eq("id", profile.orgId)
    .maybeSingle();
  const notificationContent = (
    <NotificationSettings initial={(orgNotif?.notification_settings as Partial<Record<NotificationKey, boolean>> | null) ?? {}} />
  );

  // Managers don't see (or trigger the queries for) the owner-only tabs.
  if (!isOwner) {
    return (
      <>
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Settings</h1>
          <p className="text-base text-muted">Manage the notifications your account receives.</p>
        </div>
        <SettingsTabs tabs={[{ key: "notifications", label: "Notifications", content: notificationContent }]} />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: members }, locations, { data: org }, { data: plRows }, activeDepts] = await Promise.all([
    supabase.from("profiles").select("id, full_name, access_role, location_id, all_locations").order("full_name"),
    getOrgLocations(),
    supabase.from("organizations").select("is_free_account, billing_status, card_brand, card_last4").single(),
    supabase.from("profile_locations").select("profile_id, location_id"),
    getActiveDepartments(),
  ]);
  const isFreeAccount = org?.is_free_account ?? false;
  const isPastDue = (org?.billing_status ?? "free") === "past_due";
  const cardOnFile = org?.card_brand && org?.card_last4 ? `${org.card_brand} •••• ${org.card_last4}` : null;
  const billingPortalUrl = process.env.NEXT_PUBLIC_BILLING_PORTAL_URL || "";

  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, location_id, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  const allMembers = members ?? [];

  // Which specific locations each member has been granted (and how many).
  const locationIdsByMember = new Map<string, string[]>();
  for (const r of (plRows ?? []) as { profile_id: string; location_id: string }[]) {
    const list = locationIdsByMember.get(r.profile_id) ?? [];
    list.push(r.location_id);
    locationIdsByMember.set(r.profile_id, list);
  }

  // Auth confirmation status (who hasn't accepted their invite yet) + email.
  const admin = createAdminClient();
  const statuses = await Promise.all(
    allMembers.map(async (m) => {
      try {
        const { data } = await admin.auth.admin.getUserById(m.id);
        const u = data?.user as { email?: string; email_confirmed_at?: string; confirmed_at?: string; last_sign_in_at?: string } | undefined;
        const confirmed = Boolean(u?.email_confirmed_at || u?.confirmed_at || u?.last_sign_in_at);
        return { id: m.id, email: u?.email ?? "", pending: !confirmed };
      } catch {
        return { id: m.id, email: "", pending: false };
      }
    })
  );
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const staffCountByLocation = new Map<string, number>();
  for (const m of allMembers) {
    if (!m.location_id) continue;
    staffCountByLocation.set(m.location_id, (staffCountByLocation.get(m.location_id) ?? 0) + 1);
  }
  const pricing = await getPlatformPricing();
  const firstD = Math.round(pricing.firstCents / 100);
  const addlD = Math.round(pricing.addlCents / 100);
  const monthlyTotal = locations.length > 0 ? firstD + (locations.length - 1) * addlD : 0;

  const teamContent = (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
          <div>
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Team members</span>
            <span className="text-[13px] text-muted-2 ml-1.5">{allMembers.length} users</span>
          </div>
          <div className="flex items-center gap-2">
            <BulkInviteButton locations={locations} departments={activeDepts} />
            <InviteTeamMemberButton locations={locations} departments={activeDepts} />
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
            {allMembers.map((m) => {
              const st = statusById.get(m.id);
              const accessibleLocationIds = locationIdsByMember.get(m.id) ?? [];
              const enriched = {
                ...m,
                all_locations: (m as { all_locations?: boolean }).all_locations ?? false,
                accessibleCount: accessibleLocationIds.length,
                accessibleLocationIds,
                pending: st?.pending ?? false,
                email: st?.email ?? "",
              } as TeamMember;
              return (
                <TeamMemberRow
                  key={m.id}
                  member={enriched}
                  locations={locations}
                  isCurrentUser={m.id === profile.userId}
                />
              );
            })}
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
          <AddLocationForm currentLocationCount={locations.length} isFreeAccount={isFreeAccount} firstDollars={firstD} addlDollars={addlD} />
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
              {!isFreeAccount && (
                <span className="text-[13px] font-semibold text-[#15803D] bg-[#E7F6EC] px-2.5 py-1 rounded-full">
                  {i === 0 ? `$${firstD} base` : `+$${addlD}/mo`}
                </span>
              )}
              <EditLocationForm
                location={{ id: l.id, name: l.name, address: l.address ?? "", phone: l.phone ?? "", email: l.email ?? "" }}
              />
              {locations.length > 1 && <DeleteLocationButton locationId={l.id} locationName={l.name} />}
            </div>
          </div>
        ))}
      </div>
      {isFreeAccount ? (
        <div className="bg-olive-tint rounded-2xl px-7 py-6 flex items-center gap-3">
          <Gift size={20} className="text-[#15803d] shrink-0" />
          <div>
            <div className="text-[15px] font-semibold text-[#15803d]">Free account — no billing</div>
            <div className="text-[13px] text-[#15803d] mt-0.5">Add as many locations as you need at no cost.</div>
          </div>
        </div>
      ) : (
        <>
          {locations.length > 1 && (
            <div className="bg-[#0A0A0A] rounded-2xl px-7 py-6 text-white flex items-center justify-between gap-6 flex-wrap">
              <div>
                <div className="text-[15px] font-semibold">Multi-location plan</div>
                <div className="text-[13px] text-[#A1A1A1] mt-0.5">
                  ${firstD} first location + ${addlD} per additional · billed monthly
                </div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-bold tracking-[-0.02em]">
                  ${monthlyTotal}
                  <span className="text-[15px] text-[#A1A1A1] font-medium">/mo</span>
                </div>
                <div className="text-xs text-[#A1A1A1] mt-0.5">
                  ${firstD} + {locations.length - 1} × ${addlD}
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted">
            Adding a location updates your subscription automatically once billing is connected — see the Billing tab.
          </p>
        </>
      )}
    </div>
  );

  const billingContent = (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} className="text-muted-2" />
        <h3 className="font-display text-lg font-semibold text-ink">Billing</h3>
      </div>
      {isFreeAccount ? (
        <>
          <p className="text-sm text-muted mb-4">
            This is a free account — nothing is billed, ever, regardless of how many locations you add. This tab is
            only ever visible to the account owner.
          </p>
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-[#15803d]" />
            <span className="text-sm font-semibold text-[#15803d]">Free account — no billing</span>
          </div>
        </>
      ) : (
        <>
          {isPastDue ? (
            <div className="mb-4 rounded-lg border border-[#F5C2C0] bg-[#FDECEA] px-4 py-3">
              <p className="text-sm font-semibold text-[#B42318]">Your last payment didn&apos;t go through</p>
              <p className="text-sm text-[#912018] mt-0.5">
                Update your payment method to keep your account active. If the balance stays unpaid for 30 days,
                the account is suspended.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted mb-4">
              Manage your plan, payment method, and invoices here. This tab is only ever visible to the account
              owner.
            </p>
          )}
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className={cardOnFile ? "text-ink" : "text-muted"} />
            <span className={cardOnFile ? "text-sm text-ink" : "text-sm text-muted"}>
              {cardOnFile ?? "No payment method on file"}
            </span>
          </div>
          {billingPortalUrl ? (
            <a
              href={billingPortalUrl}
              className="inline-flex items-center rounded-lg bg-brick text-white text-sm font-semibold px-4 py-2 hover:opacity-90"
            >
              Update payment method
            </a>
          ) : (
            <span className="text-xs text-muted-2">
              Payment processing is being set up — card management will appear here soon.
            </span>
          )}
        </>
      )}
      <p className="text-xs text-muted-2 mt-4 pt-4 border-t border-line">
        Billing is handled by The Maverick Agency. When active, charges appear on your statement as
        &quot;The Maverick Agency.&quot;
      </p>
    </div>
  );

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Settings</h1>
        <p className="text-base text-muted">Manage your team, locations, and subscription.</p>
      </div>

      <SettingsTabs
        tabs={[
          { key: "team", label: "Team & permissions", content: teamContent },
          { key: "locations", label: "Locations", content: locationsContent },
          { key: "notifications", label: "Notifications", content: notificationContent },
          { key: "billing", label: "Billing", content: billingContent },
          { key: "api", label: "API access", content: <ApiKeysManager keys={(apiKeys ?? []) as ApiKeyRow[]} locations={locations.map((l) => ({ id: l.id, name: l.name }))} /> },
        ]}
      />
    </>
  );
}
