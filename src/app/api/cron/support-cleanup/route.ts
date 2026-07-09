import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENT_BUCKET } from "@/lib/support-attachments";

// Runs daily. Frees storage by deleting attachments (files + rows) on tickets
// that have been CLOSED and idle for 90+ days. The tickets and their message
// text are kept — only the files are removed, so nothing is purged from a
// ticket that's still active or was recently reopened.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tickets, error } = await admin
    .from("support_tickets")
    .select("id")
    .eq("status", "closed")
    .lt("last_activity_at", cutoff)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ticketIds = (tickets ?? []).map((t) => (t as { id: string }).id);
  if (ticketIds.length === 0) return NextResponse.json({ purgedTickets: 0, purgedFiles: 0 });

  const { data: atts } = await admin.from("ticket_attachments").select("storage_path").in("ticket_id", ticketIds);
  const paths = (atts ?? []).map((a) => (a as { storage_path: string }).storage_path);

  let purgedFiles = 0;
  if (paths.length > 0) {
    await admin.storage.from(ATTACHMENT_BUCKET).remove(paths);
    await admin.from("ticket_attachments").delete().in("ticket_id", ticketIds);
    purgedFiles = paths.length;
  }

  return NextResponse.json({ purgedTickets: ticketIds.length, purgedFiles });
}
