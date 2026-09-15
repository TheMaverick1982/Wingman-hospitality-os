import "server-only";
import type { LaunchPlan } from "@/lib/launch-plan";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

// The weekly Launch Plan email: where they are and the next 1–3 moves (linked) —
// a friendly nudge so a busy week doesn't stall the rollout. Encouraging, never
// a deadline. Transactional (about their own account), so no marketing unsub.
export function buildLaunchEmail(plan: LaunchPlan, orgName: string): { subject: string; html: string } {
  const pct = Math.round((plan.doneCount / plan.totalCount) * 100);

  const subject =
    plan.doneCount === 0
      ? `Getting started with Wingman — a couple of quick moves`
      : `Your Wingman setup — ${plan.doneCount}/${plan.totalCount} done, here's what's next`;

  const statusLine =
    plan.doneCount === 0
      ? `<p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 18px;">Whenever you have a few minutes, here are the next moves to get the most out of Wingman. No rush — do them at your own pace.</p>`
      : `<p style="font-size:15px;line-height:1.55;color:#15803d;margin:0 0 18px;"><strong>Nice progress — ${plan.doneCount} of ${plan.totalCount} done.</strong> Here's what's next whenever you're ready.</p>`;

  const moves = plan.nextActions
    .map((m) => {
      return `<tr>
        <td style="padding:12px 14px;border:1px solid #eee;border-radius:10px;">
          <div style="font-size:14.5px;font-weight:600;color:#1a1a1a;">${esc(m.label)}</div>
          <div style="font-size:13px;color:#737373;margin-top:2px;">${esc(m.description)}</div>
        </td>
      </tr>`;
    })
    .join('<tr><td style="height:8px;"></td></tr>');

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:560px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 6px;">Getting set up on Wingman</p>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 14px;">Getting ${esc(orgName)} running</h1>

    <div style="background:#f5f5f4;border-radius:12px;padding:14px 16px;margin:0 0 18px;">
      <div style="font-size:13px;color:#525252;margin-bottom:8px;">${plan.doneCount} of ${plan.totalCount} milestones done · ${pct}%</div>
      <div style="height:8px;background:#e5e5e5;border-radius:99px;overflow:hidden;">
        <div style="height:8px;width:${pct}%;background:#0a6cff;border-radius:99px;"></div>
      </div>
    </div>

    ${statusLine}

    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#737373;margin:0 0 10px;">Your next ${plan.nextActions.length === 1 ? "move" : "moves"}</p>
    <table style="width:100%;border-collapse:separate;border-spacing:0;">${moves}</table>

    <div style="margin:24px 0 8px;">
      <a href="${SITE}/start-here" style="display:inline-block;background:#0a6cff;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;padding:11px 22px;border-radius:99px;">Open your launch plan →</a>
    </div>

    <hr style="border:none;border-top:1px solid #eee;margin:26px 0 12px;">
    <p style="font-size:12px;color:#999;line-height:1.5;">
      You're getting this because ${esc(orgName)} is still getting set up on Wingman. These launch reminders stop automatically once you're fully launched.
    </p>
  </div>`;

  return { subject, html };
}
