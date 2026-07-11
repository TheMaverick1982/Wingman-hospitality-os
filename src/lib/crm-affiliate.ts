import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// The affiliate lifecycle tags a contact carries in the CRM. src:affiliate is
// permanent once applied; the aff:* status tag reflects their current standing
// so you can filter + broadcast to (say) all approved affiliates.
const AFF_STATUS_TAGS = ["aff:pending", "aff:approved", "aff:rejected", "aff:suspended"] as const;
type AffStatusTag = (typeof AFF_STATUS_TAGS)[number];

// Mirror an affiliate into the CRM as a contact tagged src:affiliate + their
// current aff:* status. Best-effort — never blocks the affiliate action.
export async function mirrorAffiliateToCrm(
  input: { email: string; name?: string | null; statusTag: AffStatusTag },
  adminArg?: Admin
): Promise<void> {
  try {
    const admin = adminArg ?? createAdminClient();
    const email = input.email.trim().toLowerCase();
    if (!email) return;
    const now = new Date().toISOString();

    const { data: existing } = await admin.from("crm_contacts").select("id, tags").eq("email", email).maybeSingle();
    const ex = existing as { id: string; tags: string[] | null } | null;

    // Keep every tag except the other aff:* status tags, then add src:affiliate
    // + the new status. (One status tag at a time.)
    const kept = (ex?.tags ?? []).filter((t) => !AFF_STATUS_TAGS.includes(t as AffStatusTag));
    const tags = Array.from(new Set([...kept, "src:affiliate", input.statusTag]));

    if (ex?.id) {
      const upd: Record<string, unknown> = { tags, last_activity_at: now, updated_at: now };
      if (input.name) upd.name = input.name;
      await admin.from("crm_contacts").update(upd).eq("id", ex.id);
    } else {
      await admin
        .from("crm_contacts")
        .insert({ email, name: input.name ?? null, first_source: "affiliate", tags, last_activity_at: now });
    }
  } catch (e) {
    console.error("[crm] mirrorAffiliateToCrm failed", e);
  }
}
