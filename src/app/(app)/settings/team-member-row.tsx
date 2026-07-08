"use client";

import { useState, useTransition } from "react";
import { Pill } from "@/components/ui/pill";
import { Btn } from "@/components/ui/btn";
import type { Location } from "@/lib/data/locations";
import { updateTeamMember, resendInvite } from "./actions";

export type TeamMember = {
  id: string;
  full_name: string;
  access_role: "super_admin" | "manager" | "staff";
  location_id: string | null;
  all_locations: boolean;
  accessibleCount: number;
  pending: boolean;
  email: string;
};

type Role = "super_admin" | "manager" | "staff";

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
  const [role, setRole] = useState<Role>(member.access_role);
  const [locationId, setLocationId] = useState(member.location_id ?? locations[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);
  const [resending, startResend] = useTransition();

  function save(nextRole: Role, nextLocationId: string) {
    const formData = new FormData();
    formData.set("userId", member.id);
    formData.set("role", nextRole);
    formData.set("locationId", nextLocationId);
    startTransition(() => {
      updateTeamMember({ error: null }, formData);
    });
  }

  function doResend() {
    const formData = new FormData();
    formData.set("email", member.email);
    startResend(async () => {
      await resendInvite({ error: null }, formData);
      setResent(true);
    });
  }

  const roleChip =
    role === "super_admin" ? <Pill tone="brick">Super Admin</Pill> : <Pill>{role === "manager" ? "Manager" : "Staff"}</Pill>;

  // The current user's own row is read-only, to avoid self-lockout footguns.
  if (isCurrentUser) {
    return (
      <tr className="border-b border-line">
        <td className="px-5 py-3.5 text-ink">
          {member.full_name} <span className="text-xs text-muted-2">(you)</span>
        </td>
        <td className="px-5 py-3.5">{roleChip}</td>
        <td className="px-5 py-3.5 text-muted">
          {locationLabel(role, member.all_locations, member.accessibleCount, member.location_id, locations)}
        </td>
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
      <td className="px-5 py-3.5">
        <select
          value={role}
          onChange={(e) => {
            const next = e.target.value as Role;
            setRole(next);
            save(next, locationId);
          }}
          className="text-sm border border-line-strong rounded-md px-2 py-1 bg-panel"
        >
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </td>
      <td className="px-5 py-3.5">
        {role === "super_admin" || member.all_locations ? (
          <span className="text-muted text-sm">All locations</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                save(role, e.target.value);
              }}
              className="text-sm border border-line-strong rounded-md px-2 py-1 bg-panel"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {member.accessibleCount > 1 && <span className="text-xs text-muted-2">+{member.accessibleCount - 1}</span>}
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-muted text-xs">
        {member.pending ? (
          resent ? (
            <span className="text-[#15803D] font-semibold">Invite sent</span>
          ) : (
            <Btn small kind="ghost" disabled={resending} onClick={doResend}>
              {resending ? "Sending..." : "Resend invite"}
            </Btn>
          )
        ) : isPending ? (
          "Saving..."
        ) : (
          ""
        )}
      </td>
    </tr>
  );
}
