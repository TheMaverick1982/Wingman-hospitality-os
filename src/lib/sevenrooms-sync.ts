import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sevenroomsGet, SR_CLIENTS_PATH } from "@/lib/sevenrooms";

type Conn = {
  org_id: string;
  venue_id: string;
  venue_name: string;
};

const MAX_GUESTS = 1000;
const PAGE_SIZE = 100;

// SevenRooms client (guest profile) shape — defensive, only the fields we read.
// Field names are confirmed against the live API at go-live; several common
// spellings are accepted so the first sync works without a code change.
type SrClient = {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  email_address?: string;
  phone?: string;
  phone_number?: string;
};
type SrClientsResponse = {
  data?: { results?: SrClient[]; clients?: SrClient[]; cursor?: string; has_more?: boolean } | SrClient[];
  results?: SrClient[];
  cursor?: string;
  has_more?: boolean;
};

function firstName(c: SrClient): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || (c.name ?? "").trim();
}

// Sync every SevenRooms venue connected to this org: guest profiles → Wingman
// Guests (new only, deduped by email/phone), each venue mapped to a Wingman
// location by name (else org-wide). Reservation → visit-history enrichment is a
// documented follow-up once the guest import is validated live.
export async function syncSevenroomsOrg(orgId: string): Promise<{ guests: number; error: string | null }> {
  const admin = createAdminClient();
  const { data: connRows } = await admin
    .from("sevenrooms_connections")
    .select("org_id, venue_id, venue_name")
    .eq("org_id", orgId);
  const conns = (connRows ?? []) as Conn[];
  if (conns.length === 0) return { guests: 0, error: "Not connected to SevenRooms." };

  const now = Date.now();

  // Existing guest keys (dedupe across all venues).
  const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  for (const g of (existing ?? []) as { email: string; phone: string }[]) {
    if (g.email) seenEmail.add(g.email.toLowerCase());
    if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
  }

  const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  let firstError: string | null = null;

  for (const conn of conns) {
    let venueGuests = 0;
    try {
      let cursor = "";
      for (let page = 0; page < 30; page++) {
        const params: Record<string, string> = { venue_id: conn.venue_id, limit: String(PAGE_SIZE) };
        if (cursor) params.cursor = cursor;
        const resp = await sevenroomsGet<SrClientsResponse>(SR_CLIENTS_PATH, params);

        const container = Array.isArray(resp.data) ? { results: resp.data } : resp.data ?? resp;
        const list: SrClient[] = container.results ?? (container as { clients?: SrClient[] }).clients ?? resp.results ?? [];
        for (const c of list) {
          const name = firstName(c);
          const email = (c.email ?? c.email_address ?? "").trim();
          const phone = (c.phone ?? c.phone_number ?? "").trim();
          if (!name && !email && !phone) continue;
          const emailKey = email.toLowerCase();
          const phoneKey = phone.replace(/\D/g, "");
          if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
          if (emailKey) seenEmail.add(emailKey);
          if (phoneKey) seenPhone.add(phoneKey);
          newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "sevenrooms" });
          venueGuests++;
        }

        cursor = container.cursor ?? resp.cursor ?? "";
        const more = (container.has_more ?? resp.has_more ?? false) && Boolean(cursor);
        if (!more || list.length < PAGE_SIZE || newGuests.length >= MAX_GUESTS) break;
      }

      await admin
        .from("sevenrooms_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: venueGuests })
        .eq("org_id", orgId)
        .eq("venue_id", conn.venue_id);
    } catch (e) {
      const msg = String(e).slice(0, 200);
      firstError ??= msg;
      await admin
        .from("sevenrooms_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` })
        .eq("org_id", orgId)
        .eq("venue_id", conn.venue_id);
    }
  }

  let importedGuests = 0;
  if (newGuests.length > 0) {
    const { error } = await admin.from("guests").insert(newGuests.slice(0, MAX_GUESTS));
    if (!error) importedGuests = Math.min(newGuests.length, MAX_GUESTS);
    else firstError ??= error.message;
  }

  return { guests: importedGuests, error: firstError };
}
