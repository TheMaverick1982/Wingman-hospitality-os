import { redirect } from "next/navigation";
import { FileText, PlugZap, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageApi } from "@/lib/auth/permissions";
import { relativeTime } from "@/lib/admin/org-metrics";
import { ApiKeysManager } from "../settings/api-keys-manager";
import { type ApiKeyRow } from "../settings/api-actions";

export const metadata = { title: "API access · Wingman" };

// One "data received" tile: how many records have landed and when the last one did.
async function sourceStat(admin: ReturnType<typeof createAdminClient>, orgId: string, table: string) {
  const [{ count }, { data }] = await Promise.all([
    admin.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from(table).select("created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1),
  ]);
  const last = (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
  return { count: count ?? 0, last };
}

export default async function ApiAccessPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canManageApi(profile.accessRole)) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: keys }, { data: locationRows }, businessHealth, growth, guests, menu] = await Promise.all([
    admin.from("api_keys").select("id, name, key_prefix, location_id, created_at, last_used_at, revoked_at").eq("org_id", profile.orgId).order("created_at", { ascending: false }),
    admin.from("locations").select("id, name").eq("org_id", profile.orgId).order("name"),
    sourceStat(admin, profile.orgId, "business_health_metrics"),
    sourceStat(admin, profile.orgId, "growth_plan_entries"),
    sourceStat(admin, profile.orgId, "guests"),
    sourceStat(admin, profile.orgId, "menu_engineering_items"),
  ]);
  const locations = (locationRows ?? []) as { id: string; name: string }[];

  const sources = [
    { label: "Business Health", endpoint: "/api/v1/business-health", ...businessHealth },
    { label: "Growth Planner", endpoint: "/api/v1/growth", ...growth },
    { label: "Guests", endpoint: "/api/v1/guests", ...guests },
    { label: "Menu items", endpoint: "/api/v1/menu", ...menu },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2">
            <PlugZap size={24} className="text-brick" /> API access
          </h1>
          <p className="text-sm text-muted mt-1 max-w-xl">
            Create keys, then confirm data is flowing from your POS / Zapier into Wingman. Everything a developer needs to
            build and verify the integration.
          </p>
        </div>
        <a
          href="/api-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-brick text-sm font-semibold text-white px-4 py-2.5 shadow-sm hover:bg-brick-dark transition-colors"
        >
          <FileText size={16} /> Developer guide &amp; SOP
        </a>
      </div>

      {/* Data received — proves the POS → Zapier → Wingman flow is landing. */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Data received</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sources.map((s) => (
            <div key={s.label} className="rounded-xl border border-line p-4">
              <div className="text-[12.5px] font-semibold text-charcoal-2">{s.label}</div>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{s.count}</div>
              <div className="text-[12px] text-muted-2">records</div>
              <div className="mt-2 text-[12px] text-muted">
                {s.last ? <>Last: <span className="font-semibold text-charcoal-2">{relativeTime(s.last)}</span></> : "Nothing received yet"}
              </div>
              <code className="block mt-2 text-[10.5px] text-muted-2">{s.endpoint}</code>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted-2 mt-4">
          Counts are for your whole organization. Send a test payload from Zapier and reload — the count and “last
          received” update as records land.
        </p>
      </div>

      <ApiKeysManager keys={(keys ?? []) as ApiKeyRow[]} locations={locations} />

      {profile.accessRole === "super_admin" && (
        <div className="bg-paper border border-line rounded-2xl p-5 flex items-start gap-3">
          <Users size={18} className="text-brick shrink-0 mt-0.5" />
          <div className="text-sm text-charcoal-2">
            <p className="font-semibold text-ink mb-0.5">Give your developer their own login</p>
            <p>
              Add them under <strong>Settings → Team &amp; permissions → Invite</strong> with the role{" "}
              <strong>Developer</strong>. They&rsquo;ll land on this page only — API keys, the guide, and this data check —
              with no access to the rest of your account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
