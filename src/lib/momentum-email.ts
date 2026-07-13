import "server-only";
import type { Momentum } from "@/lib/momentum";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

// The momentum stall nudge — sent when a set-up org has gone quiet. Supportive,
// not scoldy: name the drift, give the single move to restart, one tap in.
// Transactional (about their own account), so no marketing unsubscribe.
export function buildMomentumNudgeEmail(m: Momentum, orgName: string): { subject: string; html: string } {
  const move = m.topGap?.nudge ?? "run one play on the floor today";
  const moveHref = m.topGap ? `${SITE}${m.topGap.href}` : `${SITE}/dashboard`;

  const subject = `${esc(orgName)} has gone quiet on Wingman — one move to restart`;

  const habitRows = m.habits
    .map((h) => {
      const dot = h.active ? "#4d7c0f" : "#d4d4d4";
      const val = h.active ? `${h.count} this week` : "—";
      return `<tr>
        <td style="padding:7px 0;font-size:14px;color:#1a1a1a;"><span style="display:inline-block;width:9px;height:9px;border-radius:99px;background:${dot};margin-right:8px;"></span>${esc(h.label)}</td>
        <td style="padding:7px 0;font-size:13px;color:#737373;text-align:right;">${val}</td>
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:560px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#B45309;margin:0 0 6px;">Momentum check-in</p>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 12px;">It's been quiet at ${esc(orgName)}</h1>
    <p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 16px;">
      Wingman only pays off when the plays get run. This week you're at <strong>${m.activeHabits} of ${m.totalHabits}</strong> habits —
      the results follow the habits, so let's get one going again. It takes two minutes.
    </p>

    <div style="background:#f5f5f4;border-radius:12px;padding:6px 16px;margin:0 0 18px;">
      <table style="width:100%;border-collapse:collapse;">${habitRows}</table>
    </div>

    <p style="font-size:15px;line-height:1.55;color:#1a1a1a;margin:0 0 6px;"><strong>Your one move to restart:</strong> ${esc(move)}.</p>
    <div style="margin:16px 0 8px;">
      <a href="${moveHref}" style="display:inline-block;background:#0a6cff;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;padding:11px 22px;border-radius:99px;">Do it now →</a>
    </div>

    <hr style="border:none;border-top:1px solid #eee;margin:26px 0 12px;">
    <p style="font-size:12px;color:#999;line-height:1.5;">
      You're getting this because usage at ${esc(orgName)} went quiet. Keep the weekly habits going and these stop on their own.
    </p>
  </div>`;

  return { subject, html };
}
