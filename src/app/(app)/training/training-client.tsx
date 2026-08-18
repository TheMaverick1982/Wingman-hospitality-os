"use client";

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import type { StaffMember } from "@/lib/data/staff";
import { RoleChecklist } from "./role-checklist";
import { MenuTrainingSection, type MenuItem } from "./menu-training-section";

export type ChecklistItem = { id: string; item: string; source: "wingman" | "custom" };

export type DeptData = {
  standards: ChecklistItem[];
  trainingItems: ChecklistItem[];
  trackLabel: string | null;
  hasMenu: boolean;
  menuItems: MenuItem[];
};

export type RoleSummary = {
  people: number;
  pct: number;
  signoffCount: number;
  standardsCount: number;
};

export function TrainingClient({
  data,
  summaries,
  departments,
  isGm,
  staff,
  locations,
  roleTestDepts,
  canViewRecipes,
  hideMenu,
  hasCentralMenu,
}: {
  data: Record<Department, DeptData>;
  summaries: Record<Department, RoleSummary>;
  departments: Department[];
  isGm: boolean;
  staff: StaffMember[];
  locations: Location[];
  roleTestDepts: string[];
  canViewRecipes?: boolean;
  // The staff view renders its own dedicated Menu section above, so it suppresses
  // the inline one here to avoid showing the menu twice.
  hideMenu?: boolean;
  // When the manager Training page shows the shared central "Menu" section, the
  // inline per-role menu points up to it so editors know both places manage the
  // same menu.
  hasCentralMenu?: boolean;
}) {
  const roles = departments.length ? departments : ALL_DEPARTMENTS;
  const [activeRole, setActiveRole] = useState<Department>(roles[0]);
  const dept = data[activeRole] ?? data[roles[0]];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink shrink-0">Training by role</span>
        <span className="text-sm text-muted">Guest experience first, then role skills · click a role to build</span>
      </div>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {roles.map((d) => {
          const s = summaries[d];
          const active = activeRole === d;
          const barColor = s.pct >= 90 ? "bg-[#16A34A]" : s.pct >= 75 ? "bg-brick" : "bg-[#D97706]";
          return (
            <button
              key={d}
              onClick={() => setActiveRole(d)}
              className={`text-left bg-white border rounded-2xl p-[22px] shadow-sm transition-all ${
                active ? "border-brick ring-2 ring-brick-tint" : "border-line hover:border-line-strong hover:-translate-y-0.5"
              }`}
            >
              <div className="text-sm font-semibold text-ink mb-1">{d}</div>
              <div className="text-[12.5px] text-muted-2 mb-4">{s.people} {s.people === 1 ? "person" : "people"}</div>
              <div className="text-[30px] font-semibold tracking-[-0.02em] text-ink mb-3">{s.pct}%</div>
              <div className="h-1.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${s.pct}%` }} />
              </div>
              <div className="text-xs text-muted mt-2.5">
                {s.signoffCount} sign-off{s.signoffCount === 1 ? "" : "s"} · {s.standardsCount} standards
              </div>
              <div className="text-[13px] font-semibold text-brick mt-3.5">Build training →</div>
            </button>
          );
        })}
      </div>

      {dept.hasMenu && !hideMenu && (
        <>
          {hasCentralMenu && (
            <a
              href="#menu"
              className="flex items-center gap-2 text-[12.5px] text-charcoal-2 bg-gold-tint/50 border border-gold/30 rounded-xl px-4 py-2.5 mb-3 hover:bg-gold-tint transition-colors"
            >
              <UtensilsCrossed size={14} className="text-[#b45309] shrink-0" />
              <span>
                This is the same menu you can manage in the central{" "}
                <span className="font-semibold text-[#b45309]">Menu</span> section at the top of the page — upload or edit it in either place.
              </span>
            </a>
          )}
          <MenuTrainingSection department={activeRole} items={dept.menuItems} canEdit={isGm} canViewRecipes={canViewRecipes} />
        </>
      )}

      <RoleChecklist
        key={activeRole}
        department={activeRole}
        hospitalityItems={dept.standards}
        roleItems={dept.trainingItems}
        trackLabel={dept.trackLabel}
        canEdit={isGm}
        staff={staff}
        locations={locations}
        hasTest={roleTestDepts.includes(activeRole)}
      />
    </div>
  );
}
