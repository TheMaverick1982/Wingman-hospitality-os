import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { Card } from "@/components/ui/card";
import { CreditCard, Lock } from "lucide-react";
import { InviteTeamMemberButton } from "./invite-form";
import { TeamMemberRow, type TeamMember } from "./team-member-row";
import { AddLocationForm } from "./add-location-form";

const PERMISSIONS_MATRIX: { section: string; superAdmin: string; manager: string; staff: string }[] = [
  { section: "Dashboard", superAdmin: "Full", manager: "Full", staff: "View" },
  { section: "Culture", superAdmin: "Full", manager: "Full", staff: "View" },
  { section: "Guest Bounce Back", superAdmin: "Full", manager: "Full", staff: "—" },
  { section: "Service Recovery", superAdmin: "Full", manager: "Full", staff: "View" },
  { section: "Training & Standards", superAdmin: "Full", manager: "Full", staff: "View" },
  { section: "Accountability", superAdmin: "Full", manager: "Full", staff: "View" },
  { section: "Hiring", superAdmin: "Full", manager: "Full", staff: "—" },
  { section: "Reporting", superAdmin: "Full", manager: "View", staff: "—" },
  { section: "Settings", superAdmin: "Full", manager: "—", staff: "—" },
];

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: members }, locations] = await Promise.all([
    supabase.from("profiles").select("id, full_name, access_role, location_id").order("full_name"),
    getOrgLocations(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Settings</h1>
        <p className="text-sm text-muted max-w-xl">Team & permissions, locations, and billing.</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Team & permissions</h3>
        <InviteTeamMemberButton locations={locations} />
      </div>
      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-line">
              {["Name", "Access level", "Location", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <TeamMemberRow key={m.id} member={m as TeamMember} locations={locations} />
            ))}
          </tbody>
        </table>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="font-display text-lg font-semibold mb-1 text-ink">Permissions by level</h3>
        <p className="text-xs text-muted mb-4">What each access level can see and do. Super Admin is the account owner.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-muted">Section</th>
              <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-brick">Super Admin</th>
              <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-muted">Manager</th>
              <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-muted">Staff</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS_MATRIX.map((row) => (
              <tr key={row.section} className="border-b border-line last:border-0">
                <td className="py-2.5 text-ink">{row.section}</td>
                <td className="py-2.5 text-olive font-medium">{row.superAdmin}</td>
                <td className="py-2.5 text-brick font-medium">{row.manager}</td>
                <td className="py-2.5 text-muted">{row.staff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Locations</h3>
        <AddLocationForm />
      </div>
      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm mb-6">
        <table className="w-full text-sm">
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3.5 text-ink">{l.name}</td>
                <td className="px-5 py-3.5 text-muted text-xs text-right">
                  {locations[0]?.id === l.id ? "$199/mo" : "+$100/mo"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mb-6">
        Adding a location updates your subscription automatically once billing is connected — see below.
      </p>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-muted-2" />
          <h3 className="font-display text-lg font-semibold text-ink">Billing</h3>
        </div>
        <p className="text-sm text-muted mb-4">
          Payment processing isn&apos;t connected yet. Once it is, you&apos;ll manage your plan, add or
          remove locations, and cancel from here.
        </p>
        <div className="flex items-center gap-2 opacity-50">
          <CreditCard size={16} className="text-muted" />
          <span className="text-sm text-muted">No payment method on file</span>
        </div>
      </Card>
    </div>
  );
}
