import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, ClipboardCheck, ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveMyStaff } from "@/lib/data/my-staff";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your role" };

// Staff-facing role guide: the standard a person is held to (guest-experience
// behaviors) and what they own (role duties), so they can always see what's
// expected of them. Reads the same per-role content managers author on Training
// (department_standards + department_training_items), keyed by the viewer's own
// department. No manager metrics here — just their role, made easy to see.
export default async function MyRolePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const myStaff = await resolveMyStaff(profile);
  if (!myStaff) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-1.5">Your role</h1>
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center mt-4">
          <p className="text-[15px] text-ink font-semibold">Your login isn&rsquo;t linked to your staff profile yet.</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Ask a manager to connect your account on the Staff page — then your role guide will show up here.
          </p>
        </div>
      </div>
    );
  }

  const department = myStaff.department;
  const supabase = await createClient();
  const [{ data: standardRows }, { data: dutyRows }, { data: meta }] = await Promise.all([
    supabase.from("department_standards").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_meta").select("track_label").eq("department", department).maybeSingle(),
  ]);
  const behaviors = ((standardRows ?? []) as { item: string }[]).map((r) => r.item).filter(Boolean);
  const duties = ((dutyRows ?? []) as { item: string }[]).map((r) => r.item).filter(Boolean);
  const trackLabel = (meta as { track_label?: string | null } | null)?.track_label ?? null;
  const nothingYet = behaviors.length === 0 && duties.length === 0;

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-2 hover:text-ink mb-4">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] leading-[1.12] text-ink mb-1">
        Your role: {department}
      </h1>
      <p className="text-base text-muted mb-6">
        {trackLabel ? `${trackLabel} · ` : ""}What great looks like in your role — the standard you&rsquo;re held to, and what we count on you for.
      </p>

      {nothingYet ? (
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
          <p className="text-[15px] text-ink font-semibold">Your role guide is being set up.</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Your manager is still adding what&rsquo;s expected for the {department} role. Check back soon — it&rsquo;ll show up right here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <RoleSection
            icon={<HeartHandshake size={18} className="text-brick" />}
            title="Guest experience — how we make people feel"
            blurb="The hospitality standard for your role. This is what every guest should feel from you."
            items={behaviors}
            emptyLabel="No guest-experience standards added yet for your role."
          />
          <RoleSection
            icon={<ClipboardCheck size={18} className="text-brick" />}
            title="Your responsibilities — what you own"
            blurb="The tasks and duties you're counted on for, every shift."
            items={duties}
            emptyLabel="No role responsibilities added yet for your role."
          />
        </div>
      )}
    </div>
  );
}

function RoleSection({
  icon,
  title,
  blurb,
  items,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <details open className="group bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
      <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer list-none select-none">
        <span className="w-9 h-9 rounded-[11px] bg-brick-tint flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-ink">{title}</span>
          <span className="block text-[13px] text-muted-2">{blurb}</span>
        </span>
        <span className="shrink-0 text-muted-2 text-[13px] tabular-nums transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-6 pb-5 pt-1 border-t border-[#F5F5F5]">
        {items.length > 0 ? (
          <ul className="flex flex-col gap-2.5 mt-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-[1.5] text-charcoal-2">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted mt-3">{emptyLabel}</p>
        )}
      </div>
    </details>
  );
}
