import "server-only";
import type { GoogleStanding } from "@/lib/review-summary";

// Shared HTML rendering for the review recap emails, so the scheduled cron and
// the "send a test now" button produce byte-for-byte identical emails.

export function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Turn the model's "**Header** — ..." + bullet lines into simple email HTML.
export function summaryToHtml(summary: string): string {
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const bold = escHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (line.startsWith("**")) return `<p style="margin:14px 0 4px;font-size:14px;color:#1a1a1a;">${bold}</p>`;
      const bullet = line.replace(/^[-•]\s*/, "");
      if (bullet !== line) return `<li style="font-size:13.5px;color:#333;line-height:1.5;">${escHtml(bullet).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      return `<p style="font-size:13.5px;color:#333;line-height:1.5;margin:4px 0;">${bold}</p>`;
    })
    .join("\n")
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:2px 0 8px;padding-left:20px;">${m}</ul>`);
}

// A location's current Google standing as one line, e.g.
// "Google rating: ★ 4.6 / 5 · 312 reviews · 3 new in the last 7 days".
// Empty when the location isn't connected to Google or has no rating yet.
export function googleStandingHtml(g: GoogleStanding | null | undefined, windowPhrase?: string): string {
  if (!g || (g.rating == null && g.total === 0)) return "";
  const parts = [
    g.rating != null ? `<strong>★ ${g.rating.toFixed(1)} / 5</strong>` : "No rating yet",
    `${g.total.toLocaleString("en-US")} review${g.total === 1 ? "" : "s"}`,
  ];
  if (windowPhrase) parts.push(`${g.newInPeriod} new in ${escHtml(windowPhrase)}`);
  return `<p style="font-size:13px;color:#444;margin:0 0 10px;padding:8px 10px;background:#fdf7ee;border-radius:6px;">Google rating now: ${parts.join(" · ")}</p>`;
}

// One location's block within the ownership recap.
export type RecapLocationSection = { locationName: string; summary: string; google?: GoogleStanding | null };

// The company-wide ownership recap email body — each location's own read stacked
// into a single email (what guests love / where to improve / this week, per
// location), so ownership gets the whole company in one place, broken out by store.
export function execRecapEmailHtml(p: { orgName: string; periodTitle: string; subLine: string; sections: RecapLocationSection[]; footer: string; windowPhrase?: string }): string {
  const blocks = p.sections
    .map(
      (s, i) => `
      <div style="${i > 0 ? "margin-top:26px;border-top:2px solid #ececec;padding-top:20px;" : "margin-top:18px;"}">
        <p style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#b45309;font-weight:700;margin:0 0 8px;">${escHtml(s.locationName)}</p>
        ${googleStandingHtml(s.google, p.windowPhrase)}
        ${summaryToHtml(s.summary)}
      </div>`,
    )
    .join("\n");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
      <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">${escHtml(p.periodTitle)}</p>
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${escHtml(p.orgName)}</h1>
      <p style="font-size:12.5px;color:#888;margin:0 0 4px;">${escHtml(p.subLine)}</p>
      ${blocks}
      <p style="font-size:12px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">${escHtml(p.footer)}</p>
    </div>`;
}
