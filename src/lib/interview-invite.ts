import { safeFirstName } from "@/lib/name-safety";

// The interview-invitation email sent to an applicant when a manager books their
// interview. Copy is per-org editable (organizations.interview_invite_template);
// this is the default everyone starts from and falls back to. Plain,
// client-importable module so the editor shows the default and the send path
// renders it — same shape as applicant-reply.ts.
export type InterviewInvite = { subject: string; body: string };

export const INVITE_SUBJECT_MAX = 200;
export const INVITE_BODY_MAX = 4000;

// Placeholders the copy may use.
//   {{first_name}} — applicant's first name (name-safety filtered)
//   {{restaurant}} — org name
//   {{role}}       — role they applied for
//   {{date}}       — interview date, in the location's time zone
//   {{time}}       — interview time, in the location's time zone
//   {{location}}   — location name
//   {{address}}    — location street address (blank line drops out if unset)
//   {{phone}}      — location phone (for "call if something changes")
//   {{details}}    — the manager's free-text details (who/where/what to bring)
export const INVITE_PLACEHOLDERS = [
  "{{first_name}}", "{{restaurant}}", "{{role}}", "{{date}}", "{{time}}", "{{location}}", "{{address}}", "{{phone}}", "{{details}}",
] as const;

export const DEFAULT_INTERVIEW_INVITE: InterviewInvite = {
  subject: "Your interview with {{restaurant}} — {{date}} at {{time}}",
  body: `Hi {{first_name}},

Great news — we'd love to meet you. Your interview for the {{role}} role at {{restaurant}} is confirmed:

When: {{date}} at {{time}}
Where: {{location}}
{{address}}
{{details}}

If anything changes or you're running late, please call us at {{phone}} — we'll do our best to work with you.

We're looking forward to meeting you!

The {{restaurant}} team`,
};

function nonEmpty(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

// Merge a stored template over the default so a missing/blank field always falls
// back to sensible copy (a customer can't save an empty invite).
export function normalizeInterviewInvite(raw: unknown): InterviewInvite {
  const r = (raw && typeof raw === "object" ? raw : {}) as { subject?: unknown; body?: unknown };
  return {
    subject: nonEmpty(r.subject, DEFAULT_INTERVIEW_INVITE.subject).slice(0, INVITE_SUBJECT_MAX),
    body: nonEmpty(r.body, DEFAULT_INTERVIEW_INVITE.body).slice(0, INVITE_BODY_MAX),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export type InviteVars = {
  name: string | null;
  restaurant: string;
  role: string | null;
  date: string;
  time: string;
  location: string;
  address: string | null;
  phone: string | null;
  details: string | null;
};

function fill(text: string, v: Record<string, string>): string {
  return text.replace(/\{\{\s*(first_name|name|restaurant|role|date|time|location|address|phone|details)\s*\}\}/gi, (_m, key) => {
    const k = key.toLowerCase() === "name" ? "first_name" : key.toLowerCase();
    return v[k] ?? "";
  });
}

// Render the invite into an email subject + HTML body. The applicant's name runs
// through the name-safety filter (a junk/offensive name falls back to "there").
// Copy is authored, so it's HTML-escaped and split into paragraphs; a line that
// resolves to empty (e.g. no address on file) is dropped so there's no blank gap.
export function renderInterviewInvite(tpl: InterviewInvite, vars: InviteVars): { subject: string; html: string } {
  const first = safeFirstName(vars.name) ?? "there";
  const restaurant = (vars.restaurant || "our team").trim();
  const map: Record<string, string> = {
    first_name: first,
    restaurant,
    role: vars.role?.trim() || "the team",
    date: vars.date,
    time: vars.time,
    location: vars.location || restaurant,
    address: vars.address?.trim() || "",
    phone: vars.phone?.trim() || "",
    details: vars.details?.trim() || "",
  };
  // If there's no phone on file, soften the "call us at" line so it doesn't read
  // "call us at ." — swap to a generic reply instruction.
  const safeSubjectMap = { ...map };
  const subject =
    fill(tpl.subject, safeSubjectMap).replace(/\s+/g, " ").trim().slice(0, INVITE_SUBJECT_MAX) ||
    `Your interview with ${restaurant}`;

  let bodySrc = tpl.body;
  if (!map.phone) {
    // Rewrite a "call us at {{phone}}" instruction when no number is set.
    bodySrc = bodySrc.replace(/call us at \{\{\s*phone\s*\}\}/gi, "reply to this email");
  }
  const escMap = Object.fromEntries(Object.entries(map).map(([k, val]) => [k, esc(val)]));
  const filledBody = fill(esc(bodySrc), escMap);
  const paras = filledBody
    .split(/\n{2,}/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")) // drop empty lines within a block (e.g. missing address)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `<p style="margin:0 0 14px;">${b.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.6;max-width:560px;">${paras}</div>`;
  return { subject, html };
}
