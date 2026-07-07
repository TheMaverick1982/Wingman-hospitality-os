import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { Pill } from "@/components/ui/pill";
import { Sparkles } from "lucide-react";
import { MomentModalButton } from "./moment-form";
import { WeeklyFocusForm } from "./weekly-focus-form";

export default async function CulturePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "culture");

  const supabase = await createClient();
  const [{ data: org }, { data: coreValues }, { data: moments }] = await Promise.all([
    supabase.from("organizations").select("philosophy, weekly_focus").single(),
    supabase.from("core_values").select("title, description").order("sort_order"),
    supabase
      .from("culture_moments")
      .select("id, author, about, tag, message, occurred_on")
      .order("occurred_on", { ascending: false }),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Culture</h1>
          <p className="text-sm text-muted max-w-xl">
            Not a poster on the wall. The beliefs that decide how every shift actually runs.
          </p>
        </div>
        {!canEdit && <Pill>View only</Pill>}
      </div>

      <div className="bg-charcoal rounded-xl p-8 mb-6">
        <p className="text-[#a1a1a1] text-xs uppercase tracking-wide font-semibold mb-3">Our philosophy</p>
        <p className="text-white font-display text-2xl leading-snug max-w-2xl">{org?.philosophy}</p>
      </div>

      <h3 className="font-display text-lg font-semibold mb-3 text-ink">What we believe</h3>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(coreValues ?? []).map((v) => (
          <div key={v.title} className="bg-panel border border-line border-b-[3px] rounded-2xl p-5">
            <p className="text-sm font-semibold mb-1.5 text-ink">{v.title}</p>
            <p className="text-xs leading-relaxed text-muted">{v.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-gold-tint rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-[#b45309]" />
          <h3 className="font-display text-lg font-semibold text-[#b45309]">This week&apos;s pre-shift focus</h3>
        </div>
        {canEdit ? (
          <WeeklyFocusForm initialValue={org?.weekly_focus ?? ""} />
        ) : (
          <p className="text-sm text-[#b45309]">{org?.weekly_focus || "Nothing set yet."}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Culture wall</h3>
        {canEdit && <MomentModalButton />}
      </div>
      <div className="flex flex-col gap-3">
        {(moments ?? []).map((m) => (
          <div key={m.id} className="bg-panel border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{m.about}</span>
                <Pill tone="olive">{m.tag}</Pill>
              </div>
              <span className="text-xs text-muted">{m.occurred_on}</span>
            </div>
            <p className="text-sm leading-relaxed mb-2 text-charcoal-2">{m.message}</p>
            <p className="text-xs text-muted">— {m.author}</p>
          </div>
        ))}
        {(moments ?? []).length === 0 && (
          <p className="text-sm text-muted">No culture moments yet. Recognize someone to start the wall.</p>
        )}
      </div>
    </div>
  );
}
