import "server-only";

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

// The company-wide ownership recap email body.
export function execRecapEmailHtml(p: { orgName: string; periodTitle: string; subLine: string; summary: string; footer: string }): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
      <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">${escHtml(p.periodTitle)}</p>
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${escHtml(p.orgName)}</h1>
      <p style="font-size:12.5px;color:#888;margin:0 0 16px;">${escHtml(p.subLine)}</p>
      ${summaryToHtml(p.summary)}
      <p style="font-size:12px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">${escHtml(p.footer)}</p>
    </div>`;
}
