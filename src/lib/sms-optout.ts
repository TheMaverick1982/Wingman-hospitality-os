import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const OPT_OUT_LINE = "Reply STOP to opt out.";
// Already-present opt-out phrasing — don't double up.
const HAS_OPT_OUT = /reply stop|text stop|stop to (opt|end|cancel|unsub)|opt.?out|unsubscribe/i;

// 10DLC best practice: the FIRST SMS a contact receives should carry opt-out
// language; later messages don't need to repeat it. Appends the line only when
// this is their first outbound SMS and the copy doesn't already say it.
export async function withFirstSmsOptOut(admin: Admin, contactId: string, body: string): Promise<string> {
  if (HAS_OPT_OUT.test(body)) return body;
  const { count } = await admin
    .from("crm_activities")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("kind", "sms_out");
  if ((count ?? 0) > 0) return body; // not their first outbound SMS
  return `${body} ${OPT_OUT_LINE}`;
}
