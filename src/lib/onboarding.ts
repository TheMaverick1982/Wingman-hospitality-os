import { createClient } from "@/lib/supabase/server";

export type OnboardingStep = { key: string; label: string; description: string; done: boolean; href: string };
export type OnboardingStatus = { steps: OnboardingStep[]; allDone: boolean; doneCount: number };

/**
 * Reads AI-builder-sourced ('wingman') rows as the signal that a section has
 * actually been built out, not just left at its seeded defaults -- every new
 * org already has baseline department_standards/hiring_traits rows, so a
 * simple "any rows exist" check would never read as incomplete.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, system_generated").single();
  if (!org) return { steps: [], allDone: true, doneCount: 0 };

  const [{ count: wingmanStandards }, { count: wingmanTraining }, { count: wingmanTraits }, { count: staffCount }, { count: playbookCount }] =
    await Promise.all([
      supabase.from("department_standards").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("source", "wingman"),
      supabase.from("department_training_items").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("source", "wingman"),
      supabase.from("hiring_traits").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("source", "wingman"),
      supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      supabase.from("playbook_articles").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    ]);

  const steps: OnboardingStep[] = [
    {
      key: "wizard",
      label: "Run the Setup Wizard",
      description: "Tell us about your concept and we'll draft your culture statement, core values, and starting standards.",
      done: !!org.system_generated,
      href: "/wizard",
    },
    {
      key: "training",
      label: "Build your Training & Standards",
      description: "Upload what you already use, or let Wingman build a training program for at least one role.",
      done: (wingmanStandards ?? 0) + (wingmanTraining ?? 0) > 0,
      href: "/training",
    },
    {
      key: "hiring",
      label: "Build your Hiring criteria",
      description: "Upload an existing interview guide, or let Wingman build hiring criteria for at least one role.",
      done: (wingmanTraits ?? 0) > 0,
      href: "/hiring",
    },
    {
      key: "staff",
      label: "Add your team to Staff",
      description: "Add your existing staff (one at a time or in bulk) so you can track their training and hiring history.",
      done: (staffCount ?? 0) > 0,
      href: "/staff",
    },
    {
      key: "playbook",
      label: "Create your team playbook",
      description: "Upload or write your team's guides and SOPs — or let Wingman draft one. Everyone on your team can read them under Help.",
      done: (playbookCount ?? 0) > 0,
      href: "/help",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, allDone: doneCount === steps.length, doneCount };
}
