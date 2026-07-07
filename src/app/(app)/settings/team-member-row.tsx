"use client";

import { useState, useTransition } from "react";
import { Pill } from "@/components/ui/pill";
import type { Location } from "@/lib/data/locations";
import { updateTeamMember } from "./actions";

export type TeamMember = {
  id: string;
  full_name: string;
  access_role: "super_admin" | "manager" | "staff";
  location_id: string | null;
};

export function TeamMemberRow({ member, locations }: { member: TeamMember; locations: Location[] }) {
  const [role, setRole] = useState<"manager" | "staff">(member.access_role === "super_admin" ? "manager" : member.access_role);
  const [locationId, setLocationId] = useState(member.location_id ?? locations[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function save(nextRole: string, nextLocationId: string) {
    const formData = new FormData();
    formData.set("userId", member.id);
    formData.set("role", nextRole);
    formData.set("locationId", nextLocationId);
    startTransition(() => {
      updateTeamMember({ error: null }, formData);
    });
  }

  if (member.access_role === "super_admin") {
    return (
      <tr className="border-b border-line">
        <td className="px-5 py-3.5 text-ink">{member.full_name}</td>
        <td className="px-5 py-3.5">
          <Pill tone="brick">Super Admin</Pill>
        </td>
        <td className="px-5 py-3.5 text-muted">All locations</td>
        <td className="px-5 py-3.5 text-muted text-xs">Account owner</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line">
      <td className="px-5 py-3.5 text-ink">{member.full_name}</td>
      <td className="px-5 py-3.5">
        <select
          value={role}
          onChange={(e) => {
            const next = e.target.value as "manager" | "staff";
            setRole(next);
            save(next, locationId);
          }}
          className="text-sm border border-line-strong rounded-md px-2 py-1 bg-panel"
        >
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </td>
      <td className="px-5 py-3.5">
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
      </td>
      <td className="px-5 py-3.5 text-muted text-xs">{isPending ? "Saving..." : ""}</td>
    </tr>
  );
}
