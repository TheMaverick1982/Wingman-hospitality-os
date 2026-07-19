"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Pill } from "@/components/ui/pill";

export type OrgRow = {
  id: string;
  name: string;
  locations: number;
  team: number;
  repeatRate: number;
  createdAt: string | null;
  isFranchisor: boolean;
  isFranchisee: boolean;
  isFree: boolean;
};

export function OrgTable({ rows }: { rows: OrgRow[] }) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? rows.filter((r) => r.name.toLowerCase().includes(n)) : rows;
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-[360px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search organizations…"
          className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors"
        />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Organization</th>
              <th className="px-5 py-3">Locations</th>
              <th className="px-5 py-3">Team members</th>
              <th className="px-5 py-3">Repeat rate</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((org) => (
              <tr key={org.id} className="border-b border-line last:border-b-0">
                <td className="px-5 py-4 font-semibold text-ink">
                  <div className="flex items-center gap-2 flex-wrap">
                    {org.name}
                    {org.isFranchisor && <Pill tone="brick">Franchisor</Pill>}
                    {org.isFranchisee && <Pill tone="muted">Franchisee</Pill>}
                    {org.isFree && <Pill tone="olive">Free</Pill>}
                  </div>
                </td>
                <td className="px-5 py-4 text-charcoal-2">{org.locations}</td>
                <td className="px-5 py-4 text-charcoal-2">{org.team}</td>
                <td className="px-5 py-4 text-charcoal-2">{org.repeatRate}%</td>
                <td className="px-5 py-4 text-muted-2">{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}</td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/admin/organizations/${org.id}`} className="text-sm font-semibold text-brick">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  {rows.length === 0 ? "No organizations yet." : `No organizations match “${q}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
