import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

// Owner-only CSV export of partner contacts. ?location=<id> exports one store;
// omitted exports every location the owner can see. RLS already scopes to the
// org and hides soft-deleted rows; the owner (super_admin) sees all locations.
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.accessRole !== "super_admin") {
    return NextResponse.json({ error: "Only the account owner can export contacts." }, { status: 403 });
  }

  const locationId = request.nextUrl.searchParams.get("location");
  const supabase = await createClient();

  let query = supabase
    .from("partner_contacts")
    .select("company_name, contact_name, title, email, phone, category, subcategory, website, address, location_id, status, outreach_status, interested_in, handed_off_to, next_step, last_activity_at, created_at")
    .order("company_name");
  if (locationId) query = query.eq("location_id", locationId);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: locRows } = await supabase.from("locations").select("id, name");
  const locName = new Map(((locRows ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));

  const STATUS_LABEL: Record<string, string> = {
    none: "", no_answer: "No answer", follow_up: "Follow up", booked: "Booked", not_interested: "Not interested",
  };
  const headers = [
    "Company", "Contact", "Title", "Email", "Phone", "Category", "Subcategory", "Website", "Address",
    "Location", "Status", "Interested in", "Handed off to", "Next step", "Last activity", "Created",
  ];

  type Row = {
    company_name: string; contact_name: string; title: string; email: string; phone: string;
    category: string; subcategory: string; website: string; address: string; location_id: string | null;
    status: string; outreach_status: string; interested_in: unknown; handed_off_to: string; next_step: string;
    last_activity_at: string | null; created_at: string;
  };
  const lines = [headers.map(csvCell).join(",")];
  for (const r of (rows ?? []) as Row[]) {
    const interests = Array.isArray(r.interested_in) ? (r.interested_in as string[]).join("; ") : "";
    lines.push([
      r.company_name, r.contact_name, r.title, r.email, r.phone, r.category, r.subcategory, r.website, r.address,
      r.location_id ? (locName.get(r.location_id) ?? "") : "Org-wide",
      STATUS_LABEL[r.outreach_status] ?? "", interests, r.handed_off_to, r.next_step,
      r.last_activity_at ? r.last_activity_at.slice(0, 10) : "",
      r.created_at ? r.created_at.slice(0, 10) : "",
    ].map(csvCell).join(","));
  }

  const scope = locationId ? (locName.get(locationId) ?? "location").replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "all-locations";
  const filename = `partners-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
