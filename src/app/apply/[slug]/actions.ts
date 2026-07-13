"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";
import { builtinSetting, normalizeFormConfig, type CustomAnswer } from "@/lib/application-form";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
const FALLBACK_ALERT = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";

export type ApplyState = { error: string | null; ok?: boolean };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A public visitor submits an application. Runs on the service-role client
// (there's no logged-in user), validating the org strictly by its public slug
// and only writing to that org's rows.
export async function submitApplication(slug: string, _prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const admin = createAdminClient();
  const { data: orgRow } = await admin.from("organizations").select("id, name, apply_enabled, applications_cc, notification_settings, application_form_config").eq("public_slug", slug).maybeSingle();
  const org = orgRow as { id: string; name: string; apply_enabled: boolean; applications_cc: string | null; notification_settings: Record<string, boolean> | null; application_form_config: unknown } | null;
  if (!org || !org.apply_enabled) return { error: "This application form isn't accepting submissions right now." };

  const config = normalizeFormConfig(org.application_form_config);
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
      custom_answers: customAnswers,
      source: formData.get("embed") === "1" ? "embed" : "link",
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Something went wrong submitting your application. Please try again." };
  const appId = (inserted as { id: string }).id;

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
  if (!isNotificationEnabled(org.notification_settings, "new_application")) {
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
