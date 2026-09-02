import { safeFirstName } from "@/lib/name-safety";

// The two canned applicant replies. Copy is per-org editable (stored on
// organizations.application_reply_templates); these are the defaults everyone
// starts from and falls back to. Kept in a plain, client-importable module so the
// editor can show the defaults and the send path can render them.
export const REPLY_KINDS = ["interested", "not_a_fit"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];
export type ReplyTemplate = { subject: string; body: string };
export type ReplyTemplates = Record<ReplyKind, ReplyTemplate>;

export const REPLY_KIND_LABEL: Record<ReplyKind, string> = {
  interested: "We're interested",
  not_a_fit: "Not a good fit",
};

export const SUBJECT_MAX = 200;
export const BODY_MAX = 4000;

// Placeholders the copy may use. {{first_name}} is filled from the applicant's
// name (filtered — see below); {{restaurant}} is the org name; {{role}} is the
// role they applied for (or "the team" if none).
export const REPLY_PLACEHOLDERS = ["{{first_name}}", "{{restaurant}}", "{{role}}"] as const;

export const DEFAULT_REPLY_TEMPLATES: ReplyTemplates = {
  interested: {
    subject: "Thanks for applying to {{restaurant}}",
    body: `Hi {{first_name}},

Thank you for applying to {{restaurant}} — we're glad you did, and we're interested in learning more about you.

Someone from our team will be reaching out soon about next steps. In the meantime, feel free to reply to this email with any questions.

Talk soon,
The {{restaurant}} team`,
  },
  not_a_fit: {
    subject: "Update on your application to {{restaurant}}",
    body: `Hi {{first_name}},

Thank you so much for applying to {{restaurant}} and for taking the time to tell us about yourself.

After careful consideration, we've decided not to move forward at this time. It wasn't an easy call — we genuinely appreciate your interest, and we'd welcome you to apply again down the road.

Wishing you all the best,
The {{restaurant}} team`,
  },
};

function nonEmpty(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

// Merge stored templates over the defaults, so a missing or blank field always
// falls back to sensible copy (a customer can't save an empty email).
export function normalizeReplyTemplates(raw: unknown): ReplyTemplates {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, { subject?: unknown; body?: unknown } | undefined>;
  const out = {} as ReplyTemplates;
  for (const kind of REPLY_KINDS) {
    const d = DEFAULT_REPLY_TEMPLATES[kind];
    const t = r[kind] ?? {};
    out[kind] = {
      subject: nonEmpty(t.subject, d.subject).slice(0, SUBJECT_MAX),
      body: nonEmpty(t.body, d.body).slice(0, BODY_MAX),
    };
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function fill(text: string, first: string, restaurant: string, role: string): string {
  return text
    .replace(/\{\{\s*(first_name|name)\s*\}\}/gi, first)
    .replace(/\{\{\s*restaurant\s*\}\}/gi, restaurant)
    .replace(/\{\{\s*role\s*\}\}/gi, role);
}

// Render a template into an email subject + HTML body. The applicant's name runs
// through the name-safety filter first, so a junk or offensive name is never
// echoed back — it falls back to "there" ("Hi there,"). The template body is
// authored copy, so it's HTML-escaped and turned into paragraphs (blank line =
// new paragraph); substituted values are escaped too.
export function renderReplyTemplate(
  tpl: ReplyTemplate,
  vars: { name: string | null; restaurant: string; role: string | null },
): { subject: string; html: string } {
  const first = safeFirstName(vars.name) ?? "there";
  const role = vars.role?.trim() || "the team";
  const restaurant = (vars.restaurant || "our team").trim();

  const subject =
    fill(tpl.subject, first, restaurant, role).replace(/\s+/g, " ").trim().slice(0, SUBJECT_MAX) ||
    `A note from ${restaurant}`;

  const filledBody = fill(esc(tpl.body), esc(first), esc(restaurant), esc(role));
  const paras = filledBody
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `<p style="margin:0 0 14px;">${b.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.6;max-width:560px;">${paras}</div>`;
  return { subject, html };
}
