"use client";

import { setAutoPublish, disconnectMeta } from "./actions";

type Props = {
  configured: boolean;
  connected: boolean;
  pageName: string | null;
  igUsername: string | null;
  autoPublish: boolean;
  flash?: { kind: "ok" | "error"; text: string } | null;
};

export function Connections({ configured, connected, pageName, igUsername, autoPublish, flash }: Props) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[15px] font-semibold text-ink">Auto-publish to Facebook &amp; Instagram</div>
          <div className="text-[13px] text-muted mt-0.5">
            {connected
              ? "Connected — scheduled posts can publish themselves."
              : "Connect your Meta account to publish automatically instead of by reminder."}
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-2.5">
            <form action={setAutoPublish}>
              <input type="hidden" name="on" value={(!autoPublish).toString()} />
              <button
                type="submit"
                className={`text-[13px] font-semibold rounded-full px-4 py-2 transition-colors ${
                  autoPublish ? "text-white bg-olive" : "text-charcoal-2 border border-line hover:border-brick hover:text-brick"
                }`}
              >
                {autoPublish ? "Auto-publish: ON" : "Auto-publish: OFF"}
              </button>
            </form>
            <form action={disconnectMeta} onSubmit={(e) => { if (!confirm("Disconnect Meta? Posts will fall back to reminders.")) e.preventDefault(); }}>
              <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">
                Disconnect
              </button>
            </form>
          </div>
        ) : configured ? (
          <a
            href="/api/social/meta/login"
            className="text-[14px] font-semibold text-white bg-[#1877F2] rounded-full px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            Connect Facebook &amp; Instagram
          </a>
        ) : (
          <span className="text-[13px] text-muted-2">Add META_APP_ID / META_APP_SECRET to enable</span>
        )}
      </div>

      {connected && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted border-t border-[#F1F1F1] pt-3">
          <span>Page: <span className="text-ink font-medium">{pageName ?? "—"}</span></span>
          <span>Instagram: <span className="text-ink font-medium">{igUsername ? `@${igUsername}` : "not linked"}</span></span>
          {autoPublish ? (
            <span className="text-olive font-medium">Posts publish automatically at their scheduled time.</span>
          ) : (
            <span>Auto-publish is off — you&rsquo;ll still get reminders. Use “Publish now” on a post to send it immediately.</span>
          )}
        </div>
      )}

      {connected && !igUsername && (
        <p className="text-[12px] text-[#b4884a] bg-gold-tint rounded-lg px-3 py-2">
          No Instagram Business account is linked to this Page. Link one in Meta Business settings to publish to Instagram.
        </p>
      )}

      {flash && (
        <p className={`text-[13px] font-semibold ${flash.kind === "ok" ? "text-olive" : "text-danger"}`}>{flash.text}</p>
      )}
    </div>
  );
}
