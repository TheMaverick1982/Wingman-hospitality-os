import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { PrintShell } from "../print-shell";

type Stage = { id: string; name: string; purpose: string; avoid: string; standard: string; script: string; inspect: string; timing: string };

export default async function PrintJourneyPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("journey_stages")
    .select("id, name, purpose, avoid, standard, script, inspect, timing")
    .order("sort_order", { ascending: true });
  const stages = (data ?? []) as Stage[];

  return (
    <PrintShell title="Guest Journey" subtitle="Every moment, on purpose — from arrival to the ask." orgName={profile.orgName}>
      {stages.length === 0 ? (
        <p className="text-[14px] text-muted">No journey yet. Generate one in the Guest Journey section first.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {stages.map((s, i) => (
            <li key={s.id} className="avoid-break border border-line rounded-xl p-4">
              <div className="flex items-baseline gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brick-tint text-brick inline-flex items-center justify-center text-[12px] font-bold shrink-0">{i + 1}</span>
                <span className="text-[17px] font-bold text-ink">{s.name}</span>
                {s.timing && <span className="text-[12px] font-semibold text-charcoal-2 ml-auto">{s.timing}</span>}
              </div>
              {s.purpose && <p className="text-[13px] text-muted mt-1 ml-8">{s.purpose}</p>}
              <div className="mt-2 ml-8 flex flex-col gap-1.5 text-[13.5px]">
                {s.standard && <p><span className="font-semibold text-olive">Standard: </span>{s.standard}</p>}
                {s.script && <p className="italic text-charcoal-2"><span className="not-italic font-semibold text-muted-2">Say/do: </span>{s.script}</p>}
                {s.avoid && <p><span className="font-semibold text-brick">Avoid: </span><span className="text-muted">{s.avoid}</span></p>}
                {s.inspect && <p><span className="font-semibold text-muted-2">Manager checks: </span><span className="text-muted">{s.inspect}</span></p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </PrintShell>
  );
}
