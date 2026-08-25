"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";
import { builtinSetting, normalizeFormConfig, type CustomAnswer } from "@/lib/application-form";
import { gradeScreeningAnswers } from "@/lib/hiring/screening-grader";
import { isScreeningAxis, type ScreeningAnswer } from "@/lib/screening";
import { guardPublicForm } from "@/lib/public-form-guard";
import { ALL_DEPARTMENTS, OPENING_OTHER_ROLE, type Department } from "@/lib/constants";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
const FALLBACK_ALERT = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";

export type ApplyState = { error: string | null; ok?: boolean };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Normalize a source tag (from ?src= / ?utm_source= on the apply link) to a short,
// safe, lowercase key. Empty if nothing usable was passed.
function normalizeSource(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9 ._-]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

// A public visitor submits an application. Runs on the service-role client
// (there's no logged-in user), validating the org strictly by its public slug
// and only writing to that org's rows.
export async function submitApplication(slug: string, _prev: ApplyState, formData: FormData): Promise<ApplyState> {
  // Spam protection before we touch the database. A tripped honeypot is reported
  // as a silent success (the bot sees the same "sent" screen a real applicant
  // does) so it gets no signal; a failed CAPTCHA or a flood is surfaced as an
  // error the applicant can recover from. Keyed per-slug+IP so one restaurant's
  // form can't be used to rate-limit another's.
  const guard = await guardPublicForm(formData, { rateKey: `apply:${slug}`, max: 20, windowSeconds: 3600 });
  if (!guard.ok) {
    return guard.reason === "honeypot" ? { error: null, ok: true } : { error: guard.message };
  }

  const admin = createAdminClient();
  const { data: orgRow } = await admin.from("organizations").select("id, name, apply_enabled, applications_cc").eq("public_slug", slug).maybeSingle();
  const org = orgRow as { id: string; name: string; apply_enabled: boolean; applications_cc: string | null } | null;
  if (!org || !org.apply_enabled) return { error: "This application form isn't accepting submissions right now." };

  // notification_settings and application_form_config are added by later migrations
  // — read them in an isolated, guarded query so a not-yet-applied migration can
  // never block a real applicant from submitting.
  let notificationSettings: Record<string, boolean> | null = null;
  let config = normalizeFormConfig(null);
  {
    const { data: extra } = await admin.from("organizations").select("notification_settings, application_form_config").eq("id", org.id).maybeSingle();
    if (extra) {
      const e = extra as { notification_settings: Record<string, boolean> | null; application_form_config: unknown };
      notificationSettings = e.notification_settings ?? null;
      config = normalizeFormConfig(e.application_form_config);
    }
  }
  const emailF = builtinSetting(config, "email");
  const phoneF = builtinSetting(config, "phone");
  const deptF = builtinSetting(config, "department");
  const locF = builtinSetting(config, "location");
  const availF = builtinSetting(config, "availability");
  const visitF = builtinSetting(config, "preferredVisit");
  const msgF = builtinSetting(config, "message");
  const resumeF = builtinSetting(config, "resume");

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Please enter your name." };
  const email = emailF.enabled ? String(formData.get("email") || "").trim() : "";
  const phone = phoneF.enabled ? String(formData.get("phone") || "").trim() : "";
  // Honor per-field required flags, and always keep at least one way to reach the
  // applicant whenever a contact field is shown.
  if (emailF.enabled && emailF.required && !email) return { error: `Please enter your ${emailF.label.toLowerCase()}.` };
  if (phoneF.enabled && phoneF.required && !phone) return { error: `Please enter your ${phoneF.label.toLowerCase()}.` };
  if ((emailF.enabled || phoneF.enabled) && !email && !phone) return { error: "Add an email or phone number so they can reach you." };

  const department = deptF.enabled ? String(formData.get("department") || "").trim() : "";
  if (deptF.enabled && deptF.required && !department) return { error: `Please choose a ${deptF.label.toLowerCase()}.` };
  const locationId = locF.enabled ? (String(formData.get("locationId") || "").trim() || null) : null;
  if (locF.enabled && locF.required && !locationId) return { error: `Please choose a ${locF.label.toLowerCase()}.` };
  const availability = availF.enabled ? String(formData.get("availability") || "").trim() : "";
  if (availF.enabled && availF.required && !availability) return { error: `Please fill in ${availF.label.toLowerCase()}.` };
  const message = msgF.enabled ? String(formData.get("message") || "").trim() : "";
  if (msgF.enabled && msgF.required && !message) return { error: `Please fill in ${msgF.label.toLowerCase()}.` };
  const visit = visitF.enabled ? String(formData.get("preferredVisit") || "").trim() : "";
  if (visitF.enabled && visitF.required && !visit) return { error: `Please pick a time for ${visitF.label.toLowerCase()}.` };
  const preferredVisitAt = visit ? new Date(visit).toISOString() : null;

  // Collect answers to the owner's custom questions.
  const customAnswers: CustomAnswer[] = [];
  for (const f of config.custom) {
    const value = String(formData.get(`custom_${f.id}`) || "").trim();
    if (f.required && !value) return { error: `Please answer: ${f.label}` };
    if (value) customAnswers.push({ id: f.id, label: f.label, value: value.slice(0, 2000) });
  }

  // Only accept a location that actually belongs to this org.
  let validLoc: string | null = null;
  let locationName = "";
  if (locationId) {
    const { data: loc } = await admin.from("locations").select("id, name, email").eq("id", locationId).eq("org_id", org.id).maybeSingle();
    if (loc) { validLoc = (loc as { id: string }).id; locationName = (loc as { name: string }).name; }
  }

  // Validate a required résumé before we write the row.
  const resumeFile = formData.get("resume") as File | null;
  if (resumeF.enabled && resumeF.required && !(resumeFile && resumeFile.size > 0)) {
    return { error: `Please attach your ${resumeF.label.toLowerCase()}.` };
  }

  // Pre-interview screening questions. Fetch this org's whole set once (all roles),
  // then resolve the ones for THIS applicant's role in code — the same keying the
  // form uses (a custom role lives under the "Other" bucket keyed by its name; a
  // standard role is keyed by department with no custom_role). Guarded: a missing
  // table/column degrades to "no screening" rather than blocking a real applicant.
  type ScreenRow = { id: string; department: string; custom_role: string | null; prompt: string; axis: string; required: boolean };
  let allScreening: ScreenRow[] = [];
  {
    const { data } = await admin
      .from("screening_questions")
      .select("id, department, custom_role, prompt, axis, sort_order, required")
      .eq("org_id", org.id)
      .order("sort_order");
    allScreening = ((data ?? []) as (ScreenRow & { sort_order?: number })[]).map((q) => ({
      id: q.id, department: q.department, custom_role: q.custom_role ?? null, prompt: q.prompt, axis: q.axis, required: Boolean(q.required),
    }));
  }
  const orgScreensByRole = allScreening.length > 0;

  const isKnownDept = ALL_DEPARTMENTS.includes(department as Department);
  const screeningQuestions: { id: string; prompt: string; axis: string; required: boolean }[] = department
    ? allScreening
        .filter((q) => (isKnownDept ? q.department === department && !q.custom_role : q.department === OPENING_OTHER_ROLE && q.custom_role === department))
        .map((q) => ({ id: q.id, prompt: q.prompt, axis: q.axis, required: q.required }))
    : [];

  // If this org screens applicants by role and the role field is shown, an
  // applicant must pick a role — otherwise leaving it blank would skip screening
  // entirely (no questions shown, none enforced, no grade).
  if (deptF.enabled && orgScreensByRole && !department) {
    return { error: "Please choose a role so we can ask you a couple of quick questions." };
  }
  // Enforce the selected role's required questions before creating the application.
  for (const q of screeningQuestions) {
    if (q.required && !String(formData.get(`screen_${q.id}`) || "").trim()) {
      return { error: "Please answer all required questions before submitting." };
    }
  }

  // If the link carried a job-opening id, validate it belongs to THIS org (so a
  // forged id can't attach) before tagging the application to it below.
  let openingId: string | null = null;
  const openingParam = String(formData.get("opening") || "").trim();
  if (openingParam) {
    const { data: op } = await admin.from("job_openings").select("id").eq("id", openingParam).eq("org_id", org.id).maybeSingle();
    if (op) openingId = (op as { id: string }).id;
  }

  const { data: inserted, error } = await admin
    .from("job_applications")
    .insert({
      org_id: org.id,
      location_id: validLoc,
      department,
      name,
      email,
      phone,
      availability,
      message,
      preferred_visit_at: preferredVisitAt,
      // A tagged link (?src=craigslist) wins; otherwise fall back to how they
      // reached the form (embedded on the restaurant's site vs. the direct link).
      source: normalizeSource(String(formData.get("src") || "")) || (formData.get("embed") === "1" ? "embed" : "link"),
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Something went wrong submitting your application. Please try again." };
  const appId = (inserted as { id: string }).id;

  // opening_id lands with a later migration — write it in an isolated, best-effort
  // update so a not-yet-applied column can never block a real application.
  if (openingId) {
    await admin.from("job_applications").update({ opening_id: openingId }).eq("id", appId);
  }

  // Persist custom answers separately and defensively: custom_answers is added by
  // a later migration, so keep it out of the core insert (which must never fail)
  // and write it here — if the column isn't there yet, the answers are simply
  // skipped rather than blocking the whole application.
  if (customAnswers.length > 0) {
    await admin.from("job_applications").update({ custom_answers: customAnswers }).eq("id", appId);
  }

  // Pre-interview screening: capture the role's screening answers and grade them
  // so the manager gets a read before deciding on an interview. Reuses the
  // questions fetched above; grading is an external AI call, kept best-effort so
  // it can never block a real applicant's submission.
  if (department && screeningQuestions.length > 0) {
    const screeningAnswers: ScreeningAnswer[] = screeningQuestions
      .map((q) => ({
        id: q.id,
        prompt: q.prompt,
        axis: isScreeningAxis(q.axis) ? q.axis : ("hospitality" as const),
        value: String(formData.get(`screen_${q.id}`) || "").trim().slice(0, 3000),
      }))
      .filter((a) => a.value);

    if (screeningAnswers.length > 0) {
      await admin.from("job_applications").update({ screening_answers: screeningAnswers }).eq("id", appId);
      // Grade, capped per-org-per-day so the public form can't run up AI cost.
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await admin
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .gte("created_at", since);
      if ((count ?? 0) <= 300) {
        const grade = await gradeScreeningAnswers({ orgId: org.id, department, answers: screeningAnswers });
        if (grade) await admin.from("job_applications").update({ screening_grade: grade }).eq("id", appId);
      }
    }
  }

  // Optional resume upload to the private bucket.
  const resume = formData.get("resume") as File | null;
  if (resume && resume.size > 0) {
    if (resume.size > 8 * 1024 * 1024) return { error: "Your resume is too large — 8MB max." };
    const ext = (resume.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
    const path = `${org.id}/${appId}.${ext}`;
    const bytes = Buffer.from(await resume.arrayBuffer());
    const up = await admin.storage.from("resumes").upload(path, bytes, { contentType: resume.type || "application/octet-stream", upsert: true });
    if (!up.error) await admin.from("job_applications").update({ resume_path: path }).eq("id", appId);
  }

  // Notify the location's email on file (fallback to the monitor address),
  // plus any catch-all copy addresses the owner configured.
  let locEmail = "";
  if (validLoc) {
    const { data: loc } = await admin.from("locations").select("email").eq("id", validLoc).maybeSingle();
    locEmail = ((loc as { email?: string } | null)?.email || "").trim();
  }
  const ccList = (org.applications_cc || "")
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  const recipients = [...new Set([locEmail, ...ccList].filter(Boolean))];
  if (recipients.length === 0) recipients.push(FALLBACK_ALERT);

  // The application is always recorded; the notify email is what the account can
  // switch off in Settings → Notifications.
  if (!isNotificationEnabled(notificationSettings, "new_application")) {
    return { error: null, ok: true };
  }

  const contact = [email, phone].filter(Boolean).join(" · ");
  await sendEmail({
    to: recipients,
    subject: `New application: ${name}${department ? ` — ${department}` : ""}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:600px;">
      <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 6px;">New application</p>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;">${esc(name)}</h1>
      <p style="margin:0 0 4px;">${department ? `<strong>${esc(department)}</strong>` : "Role not specified"}${locationName ? ` · ${esc(locationName)}` : ""}</p>
      ${contact ? `<p style="margin:0 0 4px;color:#525252;">${esc(contact)}</p>` : ""}
      ${availability ? `<p style="margin:8px 0 0;"><strong>Availability:</strong> ${esc(availability)}</p>` : ""}
      ${preferredVisitAt ? `<p style="margin:4px 0 0;"><strong>Wants to come in:</strong> ${esc(visit)}</p>` : ""}
      ${message ? `<p style="margin:8px 0 0;color:#525252;white-space:pre-wrap;">${esc(message)}</p>` : ""}
      <p style="margin:16px 0 0;font-size:13px;"><a href="${SITE}/hiring" style="color:#0a6cff;font-weight:600;">Open Applicants in Wingman</a> to review, schedule a visit, or start hiring.</p>
    </div>`,
  }).catch(() => undefined);

  return { error: null, ok: true };
}
