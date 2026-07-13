import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getActiveDepartments } from "@/lib/roles";
import { Pill } from "@/components/ui/pill";
import { ArrowRight } from "lucide-react";
import { AddStaffButton } from "./add-staff-form";
import { BulkAddStaffButton } from "./bulk-add-staff-form";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "staff", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = getSectionAccess(profile.accessRole, "staff", profile.permissionOverrides) === "full";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();
  let staffQ = supabase
    .from("staff_members")
    .select("id, full_name, department, email, phone, status, location_id, candidate_id, hired_on")
    .order("full_name");
  if (effectiveLocation) staffQ = staffQ.eq("location_id", effectiveLocation);

  const [{ data: staff }, locations, { data: signoffs }, activeDepts] = await Promise.all([
    staffQ,
    getOrgLocations(),
    supabase.from("training_signoffs").select("staff_id, completion_pct, occurred_on").order("occurred_on", { ascending: false }),
    getActiveDepartments(),
  ]);

  const allStaff = staff ?? [];
  // Show a count card for each role the restaurant runs (the ones set up in
  // Hiring/Training), plus any role a current staff member is still assigned to
  // so nobody silently disappears from the breakdown.
  const activeSet = new Set<string>(activeDepts);
  const staffOnlyDepts = Array.from(new Set(allStaff.map((s) => s.department as string))).filter((d) => !activeSet.has(d));
  const gridDepts: string[] = [...activeDepts, ...staffOnlyDepts];
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const latestPctByStaff: Record<string, number> = {};
  for (const s of signoffs ?? []) {
    if (s.staff_id && latestPctByStaff[s.staff_id] === undefined) latestPctByStaff[s.staff_id] = s.completion_pct;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Staff</h1>
          <p className="text-base text-muted max-w-xl">
            Your team, by role — contact details, training progress, and hiring history in one place.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <BulkAddStaffButton locations={locations} departments={activeDepts} />
            <AddStaffButton locations={locations} departments={activeDepts} />
          </div>
        )}
        {!canEdit && <Pill>View only</Pill>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {gridDepts.map((d) => {
          const count = allStaff.filter((s) => s.department === d).length;
          return (
            <div key={d} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-ink mb-1">{d}</div>
              <div className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{count}</div>
              <div className="text-xs text-muted-2 mt-1">{count === 1 ? "person" : "people"}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-[#F1F1F1] text-[17px] font-semibold tracking-[-0.01em] text-ink">
          Team directory
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAFAFA] text-left">
              {["Name", "Role", "Location", "Contact", "Training", "Status", ""].map((h, i) => (
                <th key={h || `col-${i}`} className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allStaff.map((s) => {
              const pct = latestPctByStaff[s.id];
              return (
                <tr key={s.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                    <Link href={`/staff/${s.id}`} className="flex items-center gap-2.5 group">
                      <span className="w-8 h-8 rounded-full bg-paper text-charcoal-2 flex items-center justify-center text-xs font-semibold shrink-0">
                        {initialsOf(s.full_name)}
                      </span>
                      <span className="font-semibold text-ink group-hover:text-brick group-hover:underline">{s.full_name}</span>
                      {s.candidate_id && <Pill tone="olive">Hired</Pill>}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5]">{s.department}</td>
                  <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5]">{locationName(s.location_id)}</td>
                  <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5] text-xs">
                    {s.email || s.phone ? (
                      <>
                        {s.email && <div>{s.email}</div>}
                        {s.phone && <div>{s.phone}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                    {pct != null ? (
                      <Pill tone={pct >= 100 ? "olive" : pct >= 50 ? "gold" : "muted"}>{pct}% complete</Pill>
                    ) : (
                      <span className="text-xs text-muted-2">Not started</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                    <Pill tone={s.status === "active" ? "olive" : "muted"} dot>
                      {s.status === "active" ? "Active" : "Inactive"}
                    </Pill>
                  </td>
                  <td className="px-6 py-3.5 border-b border-[#F5F5F5] text-right">
                    <Link href={`/staff/${s.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors">
                      View <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {allStaff.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted">
                  No staff added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
