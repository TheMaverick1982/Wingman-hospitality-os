import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { JourneyClient, type Stage } from "./journey-client";

export const metadata: Metadata = { title: "Guest Journey" };

// AI generation runs from this route — give it room past the default timeout.
export const maxDuration = 60;

export default async function JourneyPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "journey", profile.permissionOverrides);

  const supabase = await createClient();
  const { data } = await supabase
    .from("journey_stages")
    .select("id, sort_order, name, purpose, avoid, standard, script, inspect, timing")
    .order("sort_order", { ascending: true });
  const stages = (data ?? []) as Stage[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Guest Journey</h1>
          <p className="text-base text-muted mt-1 max-w-[640px]">
            Your guest experience, mapped moment by moment — from arrival to the ask. Each stage sets the standard, an example of
            what to say or do, and the one thing a manager watches for. It&rsquo;s the backbone your team trains on and gets
            spot-checked against.
          </p>
        </div>
        {stages.length > 0 && (
          <a href="/print/journey" target="_blank" rel="noopener noreferrer" className="shrink-0 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
            Print / PDF
          </a>
        )}
      </div>

      <JourneyClient stages={stages} canEdit={canEdit} />
    </div>
  );
}
