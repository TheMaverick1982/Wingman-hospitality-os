"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess, canEditSection } from "@/lib/auth/permissions";
import { locationScopeOr } from "@/lib/data/locations";
import { recordAiUsage } from "@/lib/ai/usage";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import type { ScreeningGrade, ScreeningAnswer } from "@/lib/screening";
import type { CustomAnswer } from "@/lib/application-form";

const QA_MODEL = "claude-sonnet-5";
const MAX_APPLICANTS = 120;
const RESUME_CHARS = 1400;

export type ApplicantMatch = {
  id: string;
  name: string;
  role: string;
  locationName: string;
  tier: string | null;
  overall: number | null;
  email: string;
  phone: string;
  appliedDate: string;
};

export type AskResult = { answer: string; matches: ApplicantMatch[]; analyzed: number; error: string | null };

const SYSTEM = `You are an expert restaurant hiring assistant. A manager gives you the pool of people who applied to their restaurant and asks a question to help them sift through it — filtering, shortlisting, comparing, or spotting themes. You answer ONLY from the applicant data provided; never invent applicants, facts, experience, or answers that aren't in the data. If the data doesn't support an answer, say so plainly. Be concise and practical — a busy operator is reading on their phone.

${HOSPITALITY_DOCTRINE}

Each applicant is labelled with a number like #3. When your answer is about specific applicants (a shortlist, a filter, a comparison, a "who…" question), list those applicants' numbers in "matches", best/most-relevant first. For a general question (a count, a theme, a summary) include the numbers you drew on, or an empty list if none apply. Output ONLY valid JSON: {"answer": string, "matches": number[]} — no markdown fences, no text outside the JSON.`;

function extractJsonObject(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  location_id: string | null;
  availability: string | null;
  message: string | null;
  status: string;
  source: string | null;
  created_at: string;
  custom_answers: CustomAnswer[] | null;
  screening_answers: ScreeningAnswer[] | null;
  screening_grade: ScreeningGrade | null;
  resume_text: string | null;
};

function digestFor(n: number, r: Row, locName: (id: string | null) => string): string {
  const lines: string[] = [];
  const role = r.department?.trim() || "Any role";
  lines.push(`#${n} ${r.name || "(no name)"} — role: ${role}; location: ${locName(r.location_id)}; applied: ${r.created_at.slice(0, 10)}; status: ${r.status}${r.source ? `; source: ${r.source}` : ""}`);
  if (r.availability?.trim()) lines.push(`availability: ${r.availability.trim().slice(0, 300)}`);
  if (r.message?.trim()) lines.push(`message: ${r.message.trim().slice(0, 500)}`);
  const g = r.screening_grade;
  if (g) lines.push(`screening: ${g.tier} (overall ${g.overall}/5) — ${g.summary}`);
  for (const a of (r.screening_answers ?? []).filter((x) => String(x.value ?? "").trim()).slice(0, 6)) {
    lines.push(`Q: ${a.prompt} A: ${String(a.value).slice(0, 400)}`);
  }
  for (const c of (r.custom_answers ?? []).filter((x) => String(x.value ?? "").trim()).slice(0, 8)) {
    lines.push(`${c.label}: ${String(c.value).slice(0, 300)}`);
  }
  if (r.resume_text?.trim()) lines.push(`resume: ${r.resume_text.trim().slice(0, RESUME_CHARS)}`);
  return lines.join("\n");
}

// Answer a natural-language question about the org's active applicant pool
// (scoped to the manager's locations), grounded strictly in what applicants
// submitted — form answers, screening answers + AI grades, and resume text.
export async function askApplicants(question: string): Promise<AskResult> {
  const empty = (error: string): AskResult => ({ answer: "", matches: [], analyzed: 0, error });
  const profile = await getCurrentProfile();
  if (!profile) return empty("Not signed in.");
  if (getSectionAccess(profile.accessRole, "hiring", profile.permissionOverrides) === "none" || !canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return empty("You don't have access to Hiring.");
  }
  const q = question.trim();
  if (!q) return empty("Ask a question first.");
  if (q.length > 500) return empty("Keep your question under 500 characters.");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return empty("The AI isn't configured yet.");

  const admin = createAdminClient();

  // Active pipeline only: everyone except hired and rejected. Location-scoped the
  // same way as the rest of Hiring (admin client bypasses RLS, so this filter is
  // the guard — see locationScopeOr).
  const scopeOr = locationScopeOr(
    { accessRole: profile.accessRole, userLocationId: profile.locationId, allLocations: profile.allLocations, accessibleLocationIds: profile.accessibleLocationIds },
    null,
  );
  let query = admin
    .from("job_applications")
    .select("id, name, email, phone, department, location_id, availability, message, status, source, created_at, custom_answers, screening_answers, screening_grade, resume_text")
    .eq("org_id", profile.orgId)
    .not("status", "in", "(hired,not_a_fit)")
    .order("created_at", { ascending: false })
    .limit(MAX_APPLICANTS);
  if (scopeOr) query = query.or(scopeOr);
  const { data: rows, error } = await query;
  if (error) return empty("Couldn't load your applicants. Please try again.");
  const applicants = (rows ?? []) as Row[];
  if (applicants.length === 0) return { answer: "There are no active applicants to analyze yet.", matches: [], analyzed: 0, error: null };

  // Location name map (org-scoped, admin).
  const { data: locRows } = await admin.from("locations").select("id, name").eq("org_id", profile.orgId);
  const locById = new Map(((locRows ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
  const locName = (id: string | null) => (id ? (locById.get(id) ?? "a location") : "no location chosen");

  const digests = applicants.map((r, i) => digestFor(i + 1, r, locName)).join("\n\n");
  const prompt = `Active applicants (${applicants.length}${applicants.length >= MAX_APPLICANTS ? ", most recent" : ""}):\n"""\n${digests.slice(0, 90000)}\n"""\n\nManager's question: ${q}\n\nRespond with ONLY the JSON described.`;

  let parsed: { answer?: string; matches?: number[] };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: QA_MODEL, max_tokens: 1400, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return empty("The AI couldn't answer just now. Please try again.");
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "ask_applicants", model: QA_MODEL, usage: data.usage }).catch(() => undefined);
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    parsed = JSON.parse(extractJsonObject(text));
  } catch {
    return empty("The AI couldn't answer just now. Please try again.");
  }

  const answer = String(parsed.answer ?? "").trim() || "No answer.";
  const refs = Array.isArray(parsed.matches) ? parsed.matches : [];
  const seen = new Set<number>();
  const matches: ApplicantMatch[] = [];
  for (const ref of refs) {
    const idx = Math.round(Number(ref)) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= applicants.length || seen.has(idx)) continue;
    seen.add(idx);
    const r = applicants[idx];
    matches.push({
      id: r.id,
      name: r.name || "(no name)",
      role: r.department?.trim() || "Any role",
      locationName: r.location_id ? (locById.get(r.location_id) ?? "") : "",
      tier: r.screening_grade?.tier ?? null,
      overall: r.screening_grade?.overall ?? null,
      email: r.email ?? "",
      phone: r.phone ?? "",
      appliedDate: r.created_at,
    });
    if (matches.length >= 25) break;
  }

  return { answer, matches, analyzed: applicants.length, error: null };
}
