import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgLocations } from "@/lib/data/locations";
import { getActiveDepartments } from "@/lib/roles";
import { getPlatformPricing } from "@/lib/pricing";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import type { NotificationKey } from "@/lib/notifications";
import { Building2, CreditCard, Gift, Lock } from "lucide-react";
import { InviteTeamMemberButton } from "./invite-form";
import { BulkInviteButton } from "./bulk-invite-form";
import { TeamMemberRow, type TeamMember } from "./team-member-row";
import { AddLocationForm } from "./add-location-form";
import { DeleteLocationButton } from "./delete-location-button";
import { EditLocationForm } from "./edit-location-form";
import { PermissionsMatrixForm } from "./permissions-matrix-form";
import { SettingsTabs } from "./tabs";
import { NotificationSettings } from "./notification-settings";
import { PushNotificationToggle } from "./push-notification-toggle";
import { ApiKeysManager } from "./api-keys-manager";
import { BillingEmailForm } from "./billing-email-form";
import { BillingCancel } from "./billing-cancel";
import { PartnerGoalsForm, type GoalRow } from "./partner-goals-form";
import { PartnersReportEmailForm } from "./partners-report-email-form";
import { TrashPanel } from "./trash-panel";
import { DirectIntegrations, type SquareConnection, type CloverConnection, type ToastConnection, type LightspeedConnection, type HeartlandConnection, type SevenroomsConnection } from "./square-card";
import { squareConfigured, squareSandboxTokenAvailable } from "@/lib/square";
import { cloverConfigured } from "@/lib/clover";
import { toastConfigured } from "@/lib/toast";
import { lightspeedConfigured } from "@/lib/lightspeed";
import { heartlandConfigured } from "@/lib/heartland-retail";
import { sevenroomsConfigured } from "@/lib/sevenrooms";
import { GlobalPaymentsCard, type BillingCardInfo } from "./global-payments-card";
import { gpConfigured, gpIsSandbox, GP_TEST_CARDS } from "@/lib/global-payments";
import { getGroupBillingSummary } from "@/lib/franchise-billing";
import { StaffActivityPanel } from "./staff-activity-panel";
import { listActivity } from "@/lib/activity-log";
import { isNativeIOS } from "@/lib/native/platform";
import type { ApiKeyRow } from "./api-actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: initialTab } = await searchParams;
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
    <div className="flex flex-col gap-5">
      <NotificationSettings initial={(orgNotif?.notification_settings as Partial<Record<NotificationKey, boolean>> | null) ?? {}} />
      <PushNotificationToggle />
    </div>
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
  const [{ data: members }, locations, { data: org }, { data: plRows }, { data: goalRows }, activeDepts] = await Promise.all([
    supabase.from("profiles").select("id, full_name, access_role, location_id, all_locations").order("full_name"),
    getOrgLocations(),
    supabase.from("organizations").select("is_free_account, billing_status, card_brand, card_last4, billing_email, cancel_at_period_end, partners_report_email, custom_addl_location_cents, plan_first_cents, plan_addl_cents, billed_by_group").single(),
    supabase.from("profile_locations").select("profile_id, location_id"),
    supabase.from("partner_goals").select("location_id, goal_new_contacts, goal_events, goal_fundraisers, goal_active_connections"),
    getActiveDepartments(),
  ]);
  const isFreeAccount = org?.is_free_account ?? false;
  const billedByGroup = (org as { billed_by_group?: boolean } | null)?.billed_by_group ?? false;
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
  // Show the customer the rate they're actually on. Existing orgs are locked to
  // the price they signed up at (grandfathered); only never-locked orgs follow
  // the live platform price. A per-org negotiated additional rate still applies.
  const orgPricing = org as { custom_addl_location_cents: number | null; plan_first_cents: number | null; plan_addl_cents: number | null } | null;
  const firstD = Math.round((orgPricing?.plan_first_cents ?? pricing.firstCents) / 100);
  const addlD = Math.round((orgPricing?.custom_addl_location_cents ?? orgPricing?.plan_addl_cents ?? pricing.addlCents) / 100);
  const monthlyTotal = locations.length > 0 ? firstD + (locations.length - 1) * addlD : 0;

  // Card on file for subscription billing (Global Payments). Safe columns only —
  // the stored payment token is never selected to the browser.
  const { data: pmRow } = await admin
    .from("billing_payment_methods")
    .select("card_brand, card_last4, card_exp_month, card_exp_year")
    .eq("org_id", profile.orgId)
    .maybeSingle();
  const billingCard: BillingCardInfo = pmRow
    ? {
        brand: (pmRow as { card_brand: string | null }).card_brand,
        last4: (pmRow as { card_last4: string | null }).card_last4,
        expMonth: (pmRow as { card_exp_month: number | null }).card_exp_month,
        expYear: (pmRow as { card_exp_year: number | null }).card_exp_year,
      }
    : null;
  const gpIsConfigured = gpConfigured();

  // Is this org the billing owner of a CENTRAL franchise group? If so, the card
  // captured here pays the group roll-up (every franchisee's price), not a
  // license for this HQ org — so show the card entry even on a comp HQ account.
  let groupBillingOwner: { name: string; totalMonthlyCents: number; memberCount: number } | null = null;
  {
    const { data: ownedGroup } = await admin
      .from("franchise_groups")
      .select("id, name, billing_mode")
      .eq("owner_user_id", profile.userId)
      .eq("billing_mode", "central")
      .maybeSingle();
    const og = ownedGroup as { id: string; name: string } | null;
    if (og) {
      const summary = await getGroupBillingSummary(og.id);
      groupBillingOwner = { name: og.name, totalMonthlyCents: summary?.totalMonthlyCents ?? 0, memberCount: summary?.members.length ?? 0 };
    }
  }

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
                location={{ id: l.id, name: l.name, address: l.address ?? "", phone: l.phone ?? "", email: l.email ?? "", timezone: l.timezone ?? "America/New_York" }}
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
      {groupBillingOwner ? (
        <>
          {(() => {
            const rollup = groupBillingOwner.totalMonthlyCents;
            const corporate = isFreeAccount ? 0 : monthlyTotal * 100; // monthlyTotal is dollars
            const combined = rollup + corporate;
            return (
              <div className="mb-4 rounded-xl border border-line bg-paper px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={16} className="text-brick" />
                  <span className="text-sm font-semibold text-ink">Franchise group billing — {groupBillingOwner.name}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Franchisee roll-up{groupBillingOwner.memberCount > 0 ? ` · ${groupBillingOwner.memberCount} location${groupBillingOwner.memberCount === 1 ? "" : "s"}` : ""}</span>
                    <span className="font-semibold text-ink tabular-nums">${(rollup / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo</span>
                  </div>
                  {!isFreeAccount && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Your corporate locations · {locations.length}</span>
                      <span className="font-semibold text-ink tabular-nums">${monthlyTotal.toLocaleString("en-US")}/mo</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-line pt-1.5 mt-0.5">
                    <span className="font-semibold text-ink">Charged to your card</span>
                    <span className="text-[18px] font-bold text-ink tabular-nums">${(combined / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}<span className="text-[12px] font-medium text-muted-2">/mo</span></span>
                  </div>
                </div>
                <p className="text-[12px] text-muted-2 mt-2 leading-snug">
                  You cover every franchisee in one monthly charge.
                  {isFreeAccount
                    ? " Your HQ account itself is comp'd — add corporate locations from Locations if you operate your own stores (ask your rep to enable paid billing)."
                    : " Corporate-owned locations you add bill per-location, just like a franchisee."}
                </p>
              </div>
            );
          })()}
          {gpIsConfigured ? (
            <GlobalPaymentsCard
              configured={gpIsConfigured}
              isSandbox={gpIsSandbox()}
              card={billingCard}
              testCards={GP_TEST_CARDS.map((c) => ({ brand: c.brand, number: c.number, exp: c.exp, cvv: c.cvv }))}
            />
          ) : (
            <span className="text-xs text-muted-2">Payment processing is being set up — the group card entry will appear here soon.</span>
          )}
          <BillingEmailForm billingEmail={org?.billing_email ?? null} />
        </>
      ) : isFreeAccount ? (
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
      ) : billedByGroup ? (
        <>
          <p className="text-sm text-muted mb-4">
            Your franchise group covers your subscription — the franchisor is billed centrally for all locations in the
            group, so there&apos;s nothing for you to pay here. You keep full control of everything else in your account.
          </p>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-brick" />
            <span className="text-sm font-semibold text-ink">Billed by your franchise group</span>
          </div>
          <BillingEmailForm billingEmail={org?.billing_email ?? null} />
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
          {gpIsConfigured ? (
            <GlobalPaymentsCard
              configured={gpIsConfigured}
              isSandbox={gpIsSandbox()}
              card={billingCard}
              testCards={GP_TEST_CARDS.map((c) => ({ brand: c.brand, number: c.number, exp: c.exp, cvv: c.cvv }))}
            />
          ) : (
            <>
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
          <BillingEmailForm billingEmail={org?.billing_email ?? null} />
          <BillingCancel
            canceled={org?.cancel_at_period_end ?? false}
            hasApi={(apiKeys ?? []).some((k) => !(k as ApiKeyRow).revoked_at)}
          />
        </>
      )}
      <p className="text-xs text-muted-2 mt-4 pt-4 border-t border-line">
        Billing is handled by The Maverick Agency. When active, charges appear on your statement as
        &quot;The Maverick Agency.&quot;
      </p>
    </div>
  );

  const goals = (goalRows ?? []) as GoalRow[];
  const orgDefaultGoal = goals.find((g) => g.location_id === null) ?? null;
  const goalByLocation = Object.fromEntries(goals.filter((g) => g.location_id).map((g) => [g.location_id as string, g]));
  const partnersContent = (
    <div className="flex flex-col gap-6">
      <PartnerGoalsForm orgDefault={orgDefaultGoal} byLocation={goalByLocation} locations={locations} />
      <PartnersReportEmailForm reportEmail={org?.partners_report_email ?? null} ownerEmail={profile.email ?? ""} />
    </div>
  );

  // Trash + audit — soft-deleted records, read via the service-role client since
  // RLS hides them. Owner-only (this whole branch is already owner-gated).
  type DelRow = { id: string; name?: string; company_name?: string; deleted_at: string | null; deleted_by: string | null };
  const [{ data: delGuests }, { data: delPartners }, { data: delStaff }, { data: auditRows }] = await Promise.all([
    admin.from("guests").select("id, name, deleted_at, deleted_by").eq("org_id", profile.orgId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    admin.from("partner_contacts").select("id, company_name, deleted_at, deleted_by").eq("org_id", profile.orgId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    admin.from("staff_members").select("id, name, deleted_at, deleted_by").eq("org_id", profile.orgId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    admin.from("audit_events").select("action, entity_type, entity_label, actor_name, created_at").eq("org_id", profile.orgId).order("created_at", { ascending: false }).limit(50),
  ]);
  const memberName = new Map(allMembers.map((m) => [m.id, m.full_name]));
  const trashItems = [
    ...((delGuests ?? []) as DelRow[]).map((g) => ({ entity: "guest" as const, id: g.id, label: g.name ?? "", deletedAt: g.deleted_at, deletedByName: memberName.get(g.deleted_by ?? "") ?? "" })),
    ...((delPartners ?? []) as DelRow[]).map((p) => ({ entity: "partner" as const, id: p.id, label: p.company_name ?? "", deletedAt: p.deleted_at, deletedByName: memberName.get(p.deleted_by ?? "") ?? "" })),
    ...((delStaff ?? []) as DelRow[]).map((s) => ({ entity: "staff" as const, id: s.id, label: s.name ?? "", deletedAt: s.deleted_at, deletedByName: memberName.get(s.deleted_by ?? "") ?? "" })),
  ].sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  const auditData = ((auditRows ?? []) as { action: string; entity_type: string; entity_label: string; actor_name: string; created_at: string }[]).map((a) => ({
    action: a.action, entityType: a.entity_type, entityLabel: a.entity_label, actorName: a.actor_name, createdAt: a.created_at,
  }));
  const trashContent = <TrashPanel items={trashItems} audit={auditData} />;

  // Square connection status (safe columns only — the token is never selected).
  const { data: sqRow } = await admin
    .from("square_connections")
    .select("merchant_id, connected_at, last_sync_at, last_sync_status, last_sync_guests, last_sync_sales_cents")
    .eq("org_id", profile.orgId)
    .maybeSingle();
  const sq = sqRow as { merchant_id: string; connected_at: string; last_sync_at: string | null; last_sync_status: string | null; last_sync_guests: number; last_sync_sales_cents: number } | null;
  const squareConnection: SquareConnection | null = sq
    ? {
        merchantId: sq.merchant_id ?? "",
        connectedAt: sq.connected_at,
        lastSyncAt: sq.last_sync_at ?? null,
        lastSyncStatus: sq.last_sync_status ?? null,
        lastSyncGuests: sq.last_sync_guests ?? 0,
        lastSyncSalesCents: sq.last_sync_sales_cents ?? 0,
      }
    : null;
  const squareIsConfigured = squareConfigured();
  const squareSandboxToken = squareSandboxTokenAvailable();

  // Clover connections (safe columns only — tokens are never selected).
  const { data: cloverRows } = await admin
    .from("clover_connections")
    .select("merchant_id, merchant_name, connected_at, last_sync_at, last_sync_status")
    .eq("org_id", profile.orgId)
    .order("connected_at", { ascending: true });
  const cloverConnections: CloverConnection[] = ((cloverRows ?? []) as {
    merchant_id: string;
    merchant_name: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[]).map((c) => ({
    merchantId: c.merchant_id,
    merchantName: c.merchant_name ?? "",
    connectedAt: c.connected_at,
    lastSyncAt: c.last_sync_at ?? null,
    lastSyncStatus: c.last_sync_status ?? null,
  }));
  const cloverIsConfigured = cloverConfigured();

  // Toast connections (safe columns only — no secrets stored for Toast anyway).
  const { data: toastRows } = await admin
    .from("toast_connections")
    .select("restaurant_guid, restaurant_name, connected_at, last_sync_at, last_sync_status")
    .eq("org_id", profile.orgId)
    .order("connected_at", { ascending: true });
  const toastConnections: ToastConnection[] = ((toastRows ?? []) as {
    restaurant_guid: string;
    restaurant_name: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[]).map((c) => ({
    restaurantGuid: c.restaurant_guid,
    restaurantName: c.restaurant_name ?? "",
    connectedAt: c.connected_at,
    lastSyncAt: c.last_sync_at ?? null,
    lastSyncStatus: c.last_sync_status ?? null,
  }));
  const toastIsConfigured = toastConfigured();

  // Lightspeed connections (safe columns only — tokens are never selected).
  const { data: lightspeedRows } = await admin
    .from("lightspeed_connections")
    .select("account_id, account_name, connected_at, last_sync_at, last_sync_status")
    .eq("org_id", profile.orgId)
    .order("connected_at", { ascending: true });
  const lightspeedConnections: LightspeedConnection[] = ((lightspeedRows ?? []) as {
    account_id: string;
    account_name: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[]).map((c) => ({
    accountId: c.account_id,
    accountName: c.account_name ?? "",
    connectedAt: c.connected_at,
    lastSyncAt: c.last_sync_at ?? null,
    lastSyncStatus: c.last_sync_status ?? null,
  }));
  const lightspeedIsConfigured = lightspeedConfigured();

  // Heartland Retail connections (safe columns only — the access token is a
  // secret and is never selected to the browser).
  const { data: heartlandRows } = await admin
    .from("heartland_retail_connections")
    .select("account_host, account_name, connected_at, last_sync_at, last_sync_status")
    .eq("org_id", profile.orgId)
    .order("connected_at", { ascending: true });
  const heartlandConnections: HeartlandConnection[] = ((heartlandRows ?? []) as {
    account_host: string;
    account_name: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[]).map((c) => ({
    host: c.account_host,
    name: c.account_name ?? "",
    connectedAt: c.connected_at,
    lastSyncAt: c.last_sync_at ?? null,
    lastSyncStatus: c.last_sync_status ?? null,
  }));
  const heartlandIsConfigured = heartlandConfigured();

  // SevenRooms connections (safe columns only — no secrets stored).
  const { data: sevenroomsRows } = await admin
    .from("sevenrooms_connections")
    .select("venue_id, venue_name, connected_at, last_sync_at, last_sync_status")
    .eq("org_id", profile.orgId)
    .order("connected_at", { ascending: true });
  const sevenroomsConnections: SevenroomsConnection[] = ((sevenroomsRows ?? []) as {
    venue_id: string;
    venue_name: string;
    connected_at: string;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[]).map((c) => ({
    venueId: c.venue_id,
    venueName: c.venue_name ?? "",
    connectedAt: c.connected_at,
    lastSyncAt: c.last_sync_at ?? null,
    lastSyncStatus: c.last_sync_status ?? null,
  }));
  const sevenroomsIsConfigured = sevenroomsConfigured();

  // Staff activity trail (owner-only). Paginated — the first page loads here, and
  // "Load more" in the panel pulls older pages via loadMoreActivityAction.
  const { rows: activity, hasMore: activityHasMore } = await listActivity(profile.orgId, 0, undefined, profile.locationTimezone);
  const activityStaff = allMembers.map((m) => ({ id: m.id, name: m.full_name }));

  // App Review compliance (guideline 3.1.1): hide the Billing tab (plan pricing,
  // add-a-card, subscription management) inside the native iOS app. Billing is
  // managed on the web.
  const nativeIOS = await isNativeIOS();

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
          { key: "partners", label: "Partners", content: partnersContent },
          { key: "notifications", label: "Notifications", content: notificationContent },
          ...(nativeIOS ? [] : [{ key: "billing", label: "Billing", content: billingContent }]),
          { key: "api", label: "API access", content: (
            <div className="flex flex-col gap-6">
              <DirectIntegrations
                configured={squareIsConfigured}
                connection={squareConnection}
                sandboxTokenAvailable={squareSandboxToken}
                cloverConfigured={cloverIsConfigured}
                cloverConnections={cloverConnections}
                toastConfigured={toastIsConfigured}
                toastConnections={toastConnections}
                lightspeedConfigured={lightspeedIsConfigured}
                lightspeedConnections={lightspeedConnections}
                heartlandConfigured={heartlandIsConfigured}
                heartlandConnections={heartlandConnections}
                sevenroomsConfigured={sevenroomsIsConfigured}
                sevenroomsConnections={sevenroomsConnections}
              />
              <ApiKeysManager keys={(apiKeys ?? []) as ApiKeyRow[]} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
            </div>
          ) },
          { key: "activity", label: "Activity", content: <StaffActivityPanel rows={activity} staff={activityStaff} initialHasMore={activityHasMore} /> },
          { key: "trash", label: "Trash", content: trashContent },
        ]}
        initialKey={initialTab}
      />
    </>
  );
}
