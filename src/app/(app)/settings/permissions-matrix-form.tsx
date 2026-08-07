"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { getSectionAccess, EDITABLE_SECTIONS, type PermissionOverrides, type Section, type SectionAccess } from "@/lib/auth/permissions";
import { updatePermissionOverrides, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

const SECTION_LABELS: Record<Section, string> = {
  dashboard: "Dashboard",
  culture: "Culture",
  bounceback: "Guest Bounce Back",
  recovery: "Service Recovery",
  training: "Training & Standards",
  journey: "Guest Journey",
  accountability: "Accountability",
  hiring: "Hiring",
  staff: "Staff",
  growth: "Revenue Growth Planner",
  menu: "Menu Engineering",
  audit: "Standout Audit",
  partners: "Partners",
  reporting: "Reporting",
  questions: "Questions",
  reviews: "Guest Reviews",
  shift: "Shift Board",
  manager_channel: "Manager Channel",
  settings: "Settings",
};

const ALL_SECTIONS: Section[] = [...EDITABLE_SECTIONS, "settings"];
const LEVEL_OPTIONS: SectionAccess[] = ["full", "view", "none"];
const LEVEL_LABEL: Record<SectionAccess, string> = { full: "Full", view: "View", none: "—" };
const LEVEL_PILL: Record<SectionAccess, string> = {
  full: "bg-[#E7F6EC] text-[#15803D]",
  view: "bg-brick-tint text-brick-dark",
  none: "bg-paper text-muted-2",
};

export function PermissionsMatrixForm({ initialOverrides }: { initialOverrides: PermissionOverrides }) {
  const [overrides, setOverrides] = useState<PermissionOverrides>(initialOverrides);
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updatePermissionOverrides(prev, formData);
    if (!result.error) setSaved(true);
    return result;
  }, initialState);

  function setLevel(section: Section, role: "manager" | "shift_lead" | "staff", value: SectionAccess) {
    setOverrides((o) => ({ ...o, [section]: { ...o[section], [role]: value } }));
    setSaved(false);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="overridesJson" value={JSON.stringify(overrides)} />
      <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] bg-[#FAFAFA] border-b border-line">
          <div className="px-[18px] py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em]">Section</div>
          <div className="px-3 py-3 text-[11.5px] font-bold text-ink text-center">Super Admin</div>
          <div className="px-3 py-3 text-[11.5px] font-bold text-brick-dark text-center">Manager</div>
          <div className="px-3 py-3 text-[11.5px] font-bold text-brick-dark text-center">Shift Lead</div>
          <div className="px-3 py-3 text-[11.5px] font-bold text-charcoal-2 text-center">Staff</div>
        </div>
        {ALL_SECTIONS.map((section) => {
          const editable = (EDITABLE_SECTIONS as Section[]).includes(section);
          return (
            <div key={section} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] items-center border-b border-[#F5F5F5] last:border-0">
              <div className="px-[18px] py-3 text-sm font-medium text-ink">{SECTION_LABELS[section]}</div>
              <div className="px-3 py-2.5 text-center">
                <span className="inline-block min-w-[58px] py-1 rounded-full text-xs font-semibold bg-[#E7F6EC] text-[#15803D]">Full</span>
              </div>
              {(["manager", "shift_lead", "staff"] as const).map((role) => {
                const level = getSectionAccess(role, section, overrides);
                return (
                  <div key={role} className="px-3 py-2 text-center">
                    {editable ? (
                      <select
                        value={level}
                        onChange={(e) => setLevel(section, role, e.target.value as SectionAccess)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 outline-none cursor-pointer ${LEVEL_PILL[level]}`}
                      >
                        {LEVEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {LEVEL_LABEL[opt]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block min-w-[58px] py-1 rounded-full text-xs font-semibold ${LEVEL_PILL[level]}`}>
                        {LEVEL_LABEL[level]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {state.error && <p className="text-sm text-danger mt-3">{state.error}</p>}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-muted-2">Settings access always stays with the account owner and can&apos;t be changed here.</p>
        <div className="flex items-center gap-3">
          {saved && !pending && <span className="text-xs font-semibold text-[#15803D]">Saved</span>}
          <Btn small type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Btn>
        </div>
      </div>
    </form>
  );
}
