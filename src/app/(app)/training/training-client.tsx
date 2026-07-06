"use client";

import { useState } from "react";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { RoleChecklist } from "./role-checklist";
import { MenuReferenceForm } from "./menu-reference-form";

export type DeptData = {
  standards: string[];
  trainingItems: string[];
  trackLabel: string | null;
  hasMenu: boolean;
  menuContent: string;
};

export function TrainingClient({
  data,
  isGm,
}: {
  data: Record<Department, DeptData>;
  isGm: boolean;
}) {
  const [activeRole, setActiveRole] = useState<Department>(ALL_DEPARTMENTS[0]);
  const dept = data[activeRole];

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {ALL_DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => setActiveRole(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              activeRole === d ? "bg-charcoal text-white border-charcoal" : "bg-white text-ink border-line"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {dept.hasMenu && (
        <MenuReferenceForm department={activeRole} initialContent={dept.menuContent} isGm={isGm} />
      )}

      <RoleChecklist
        key={activeRole}
        department={activeRole}
        hospitalityItems={dept.standards}
        roleItems={dept.trainingItems}
        trackLabel={dept.trackLabel}
      />
    </div>
  );
}
