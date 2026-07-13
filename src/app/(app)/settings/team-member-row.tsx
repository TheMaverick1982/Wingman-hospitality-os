"use client";

import { useState, useTransition } from "react";
import { Pill } from "@/components/ui/pill";
import { Btn } from "@/components/ui/btn";
import type { Location } from "@/lib/data/locations";
import { resendInvite, deleteTeamMember } from "./actions";
import { EditTeamMemberForm } from "./edit-team-member-form";

export type TeamMember = {
  id: string;
  full_name: string;
  access_role: "super_admin" | "manager" | "shift_lead" | "staff";
  location_id: string | null;
  all_locations: boolean;
  accessibleCount: number;
  accessibleLocationIds: string[];
  pending: boolean;
  email: string;
};

type Role = "super_admin" | "manager" | "shift_lead" | "staff";

function locationLabel(role: Role, allLocations: boolean, accessibleCount: number, home: string | null, locations: Location[]): string {
  if (role === "super_admin" || allLocations) return "All locations";
  const homeName = locations.find((l) => l.id === home)?.name ?? "—";
  return accessibleCount > 1 ? `${homeName} +${accessibleCount - 1}` : homeName;
}

export function TeamMemberRow({
  member,
  locations,
  isCurrentUser,
}: {
  member: TeamMember;
  locations: Location[];
  isCurrentUser: boolean;
}) {
  const role = member.access_role;
  const [resent, setResent] = useState(false);
  const [resending, startResend] = useTransition();

  function doResend() {
    const formData = new FormData();
    formData.set("email", member.email);
    startResend(async () => {
      await resendInvite({ error: null }, formData);
      setResent(true);
    });
  }

  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  function doRemove() {
    if (!window.confirm(`Remove ${member.full_name}? This permanently deletes their account and access. This can't be undone.`)) return;
    setRemoveError(null);
    startRemove(async () => {
      const res = await deleteTeamMember(member.id);
      if (res.error) setRemoveError(res.error);
    });
  }

  const roleChip =
    role === "super_admin" ? (
      <Pill tone="brick">Super Admin</Pill>
    ) : (
      <Pill>{role === "manager" ? "Manager" : role === "shift_lead" ? "Shift Lead" : "Staff"}</Pill>
    );

  const locLabel = locationLabel(role, member.all_locations, member.accessibleCount, member.location_id, locations);

  // The current user's own row is read-only, to avoid self-lockout footguns.
  if (isCurrentUser) {
    return (
      <tr className="border-b border-line">
        <td className="px-5 py-3.5 text-ink">
          {member.full_name} <span className="text-xs text-muted-2">(you)</span>
        </td>
        <td className="px-5 py-3.5">{roleChip}</td>
        <td className="px-5 py-3.5 text-muted">{locLabel}</td>
        <td className="px-5 py-3.5 text-muted text-xs">{role === "super_admin" ? "Account owner" : ""}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line">
      <td className="px-5 py-3.5 text-ink">
        <div className="flex items-center gap-2">
          {member.full_name}
          {member.pending && (
            <span className="text-[11px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2 py-0.5 rounded-full">Pending</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5">{roleChip}</td>
      <td className="px-5 py-3.5 text-muted">{locLabel}</td>
      <td className="px-5 py-3.5 text-muted text-xs">
        <div className="flex items-center justify-end gap-3">
          {member.pending &&
            (resent ? (
              <span className="text-[#15803D] font-semibold">Invite sent</span>
            ) : (
              <Btn small kind="ghost" disabled={resending} onClick={doResend}>
                {resending ? "Sending..." : "Resend invite"}
              </Btn>
            ))}
          <EditTeamMemberForm
            member={{
              id: member.id,
              full_name: member.full_name,
              access_role: member.access_role,
              all_locations: member.all_locations,
              accessibleLocationIds: member.accessibleLocationIds,
            }}
            locations={locations}
          />
          <button
            type="button"
            onClick={doRemove}
            disabled={removing}
            className="font-semibold text-brick hover:opacity-70 disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
        {removeError && <div className="text-brick text-right mt-1">{removeError}</div>}
      </td>
    </tr>
  );
}
