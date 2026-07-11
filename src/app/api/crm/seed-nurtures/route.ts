import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NURTURE_SEQUENCES, RETIRED_SOURCES } from "@/lib/crm-nurtures";

// One-time (idempotent) seeder for the spec nurture sequences (demo / calculator
// / scorecard). Rewrites each sequence's steps to the authoritative spec copy and
// cadence, always leaving them in DRAFT (published=false) so nothing sends until
// reviewed and published in /admin/crm/automations. Retires the legacy sales-chat
// sequence. Guarded by CRON_SECRET (Bearer) — call once after deploy:
//
//   curl -X POST https://www.joinwingman.app/api/crm/seed-nurtures \
//        -H "authorization: Bearer $CRON_SECRET"
//
// Safety valve: a sequence that has already been PUBLISHED is left untouched, so a
// re-run never clobbers copy you've reviewed and shipped. Add ?force=1 to override.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const result: { source: string; action: string; steps?: number }[] = [];

  for (const seq of NURTURE_SEQUENCES) {
    // Find or create the sequence for this source.
    const { data: existing } = await admin
      .from("crm_sequences")
      .select("id, published")
      .eq("source", seq.source)
      .maybeSingle();
    const ex = existing as { id: string; published: boolean } | null;

    if (ex?.published && !force) {
      result.push({ source: seq.source, action: "skipped (published)" });
      continue;
    }

    let sequenceId = ex?.id;
    if (sequenceId) {
      await admin
        .from("crm_sequences")
        .update({ name: seq.name, active: true, published: false, updated_at: now })
        .eq("id", sequenceId);
    } else {
      const { data: created } = await admin
        .from("crm_sequences")
        .insert({ source: seq.source, name: seq.name, active: true, published: false })
        .select("id")
        .single();
      sequenceId = (created as { id: string } | null)?.id;
    }
    if (!sequenceId) {
      result.push({ source: seq.source, action: "error (no id)" });
      continue;
    }

    // Replace the steps wholesale with the spec copy.
    await admin.from("crm_sequence_steps").delete().eq("sequence_id", sequenceId);
    const rows = seq.steps.map((s) => ({
      sequence_id: sequenceId,
      step_order: s.step_order,
      delay_days: s.delay_days,
      subject: s.subject,
      body: s.body,
      transactional: s.transactional,
      send_condition: s.send_condition,
      active: true,
    }));
    await admin.from("crm_sequence_steps").insert(rows);
    result.push({ source: seq.source, action: ex ? "reseeded" : "created", steps: rows.length });
  }

  // Retire legacy sequences (spec folds sales-chat into the demo funnel).
  for (const source of RETIRED_SOURCES) {
    const { data: retired } = await admin
      .from("crm_sequences")
      .update({ active: false, published: false, updated_at: now })
      .eq("source", source)
      .select("id");
    if ((retired ?? []).length) result.push({ source, action: "retired" });
  }

  return NextResponse.json({ ok: true, seeded: result });
}
