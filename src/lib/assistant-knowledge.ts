import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/profile";
import { resolveMyStaff } from "@/lib/data/my-staff";
import { getActiveDepartments } from "@/lib/roles";
import { canEditSection } from "@/lib/auth/permissions";

// Builds the "RESTAURANT KNOWLEDGE" corpus for the in-app assistant: THIS org's
// own content, so the assistant can answer "how do we do things here" instead of
// sending staff to find a manager. Covers the culture/core values, each role's
// overview + guest standards + duties, the menu (with allergens), and the
// owner-authored Team Playbook (the org's own SOPs/policies — the free-form
// knowledge source).
//
// Scoped to what the asker can already see: a line cook gets their own role's
// standards/duties + the shared culture, menu, and playbook; a manager/owner
// gets every active role. Read through the caller's RLS-scoped client so it can
// never return another org's data. Every query is guarded, so a not-yet-applied
// migration (a missing column/table) degrades to "less knowledge" instead of
// erroring the whole assistant. Returns "" when nothing is documented yet.
type Row = Record<string, unknown>;

async function safeRows(q: PromiseLike<{ data: unknown }>): Promise<Row[]> {
  try {
    const { data } = await q;
    return Array.isArray(data) ? (data as Row[]) : [];
  } catch {
    return [];
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export async function buildRestaurantKnowledge(
  supabase: SupabaseClient,
  profile: CurrentProfile
): Promise<string> {
  // Who sees which roles' content. Managers/owners (can edit training or staff)
  // see every active role; everyone else sees only their own role.
  const canSeeAllRoles =
    canEditSection(profile.accessRole, "training", profile.permissionOverrides) ||
    canEditSection(profile.accessRole, "staff", profile.permissionOverrides);

  let scopeDepts: string[] = [];
  if (canSeeAllRoles) {
    scopeDepts = await getActiveDepartments().catch(() => []);
  } else {
    const myStaff = await resolveMyStaff(profile).catch(() => null);
    scopeDepts = myStaff?.department ? [myStaff.department] : [];
  }

  const [org, values, metas, standards, duties, menu, playbook] = await Promise.all([
    safeRows(supabase.from("organizations").select("philosophy, owner_mindset, x_factor")),
    safeRows(supabase.from("core_values").select("title, description").order("sort_order")),
    safeRows(supabase.from("department_meta").select("department, description")),
    safeRows(supabase.from("department_standards").select("department, item").order("sort_order")),
    safeRows(supabase.from("department_training_items").select("department, item").order("sort_order")),
    safeRows(
      supabase
        .from("menu_items")
        .select("name, category, description, allergens, pairing_suggestion, upsell_suggestion")
        .order("category")
    ),
    safeRows(supabase.from("playbook_articles").select("title, body").order("sort_order")),
  ]);

  const sections: string[] = [];

  // Owner's Mindset + philosophy — the culture core, first so the assistant
  // reasons from it. Everyone sees this.
  const orgRow = org[0] ?? {};
  const mindsetParts: string[] = [];
  if (str(orgRow.owner_mindset)) mindsetParts.push(`Owner's Mindset (how we treat this place):\n${str(orgRow.owner_mindset)}`);
  if (str(orgRow.philosophy)) mindsetParts.push(`Our culture statement: ${str(orgRow.philosophy)}`);
  if (str(orgRow.x_factor)) mindsetParts.push(`What makes us stand out: ${str(orgRow.x_factor)}`);
  if (mindsetParts.length) sections.push("### Who we are\n" + mindsetParts.join("\n\n"));

  // Culture / core values — shared, everyone.
  const valueLines = values
    .map((v) => `- ${str(v.title)}${str(v.description) ? `: ${str(v.description)}` : ""}`)
    .filter((l) => l !== "- ");
  if (valueLines.length) sections.push("### Our culture & core values\n" + valueLines.join("\n"));

  // Role overview + guest standards + duties, per in-scope role.
  const overviewByDept = new Map(metas.map((m) => [str(m.department), str(m.description)]));
  for (const dept of scopeDepts) {
    const parts: string[] = [];
    const overview = overviewByDept.get(dept);
    if (overview) parts.push(overview);
    const s = standards.filter((r) => str(r.department) === dept).map((r) => `- ${str(r.item)}`);
    if (s.length) parts.push("Guest-experience standards:\n" + s.join("\n"));
    const d = duties.filter((r) => str(r.department) === dept).map((r) => `- ${str(r.item)}`);
    if (d.length) parts.push("Responsibilities:\n" + d.join("\n"));
    if (parts.length) sections.push(`### ${dept} role\n${parts.join("\n")}`);
  }

  // Menu — shared (allergens matter to everyone).
  const menuLines = menu
    .map((m) => {
      const bits = [
        str(m.description),
        str(m.allergens) ? `Allergens: ${str(m.allergens)}` : "",
        str(m.pairing_suggestion) ? `Pairs with: ${str(m.pairing_suggestion)}` : "",
        str(m.upsell_suggestion) ? `Upsell: ${str(m.upsell_suggestion)}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const name = str(m.name);
      if (!name) return "";
      return `- ${name}${str(m.category) ? ` [${str(m.category)}]` : ""}${bits ? `: ${bits}` : ""}`;
    })
    .filter(Boolean);
  if (menuLines.length) sections.push("### Menu\n" + menuLines.join("\n"));

  // Owner-authored Team Playbook — the org's own SOPs & policies (free-form).
  const playbookBlocks = playbook
    .map((p) => (str(p.title) ? `**${str(p.title)}**\n${str(p.body)}` : ""))
    .filter(Boolean);
  if (playbookBlocks.length)
    sections.push("### Team Playbook (our own guides & policies)\n" + playbookBlocks.join("\n\n"));

  return sections.join("\n\n");
}
