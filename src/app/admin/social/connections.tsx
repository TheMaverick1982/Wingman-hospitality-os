"use client";

import { setAutoPublish, disconnectMeta, disconnectLinkedIn } from "./actions";

type Props = {
  anyConnected: boolean;
  autoPublish: boolean;
  meta: { configured: boolean; connected: boolean; pageName: string | null; igUsername: string | null };
  linkedin: { configured: boolean; connected: boolean; name: string | null };
  flash?: { kind: "ok" | "error"; text: string } | null;
};

export function Connections({ anyConnected, autoPublish, meta, linkedin, flash }: Props) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[15px] font-semibold text-ink">Auto-publish</div>
          <div className="text-[13px] text-muted mt-0.5">
            {anyConnected
              ? "Connect the platforms you post to, then turn auto-publish on to have scheduled posts go out on their own."
              : "Connect a platform below to publish automatically instead of by reminder."}
          </div>
        </div>
        {anyConnected && (
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
        )}
      </div>

      {/* Facebook + Instagram (Meta) */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-[#F1F1F1] pt-3">
        <div className="text-[13.5px]">
          <span className="font-semibold text-ink">Facebook &amp; Instagram</span>
          {meta.connected ? (
            <span className="text-muted ml-2">
              {meta.pageName ?? "Page"}
              {meta.igUsername ? ` · @${meta.igUsername}` : " · no IG linked"}
            </span>
          ) : (
            <span className="text-muted ml-2">Not connected</span>
          )}
        </div>
        {meta.connected ? (
          <form action={disconnectMeta} onSubmit={(e) => { if (!confirm("Disconnect Meta?")) e.preventDefault(); }}>
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">Disconnect</button>
          </form>
        ) : meta.configured ? (
          <a href="/api/social/meta/login" className="text-[13px] font-semibold text-white bg-[#1877F2] rounded-full px-4 py-2 hover:opacity-90 transition-opacity">
            Connect
          </a>
        ) : (
          <span className="text-[12px] text-muted-2">Add META_APP_ID / META_APP_SECRET</span>
        )}
      </div>

      {/* LinkedIn */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-[#F1F1F1] pt-3">
        <div className="text-[13.5px]">
          <span className="font-semibold text-ink">LinkedIn</span>
          <span className="text-muted ml-2">{linkedin.connected ? (linkedin.name ?? "Connected") : "Not connected"}</span>
        </div>
        {linkedin.connected ? (
          <form action={disconnectLinkedIn} onSubmit={(e) => { if (!confirm("Disconnect LinkedIn?")) e.preventDefault(); }}>
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">Disconnect</button>
          </form>
        ) : linkedin.configured ? (
          <a href="/api/social/linkedin/login" className="text-[13px] font-semibold text-white bg-[#0A66C2] rounded-full px-4 py-2 hover:opacity-90 transition-opacity">
            Connect
          </a>
        ) : (
          <span className="text-[12px] text-muted-2">Add LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET</span>
        )}
      </div>

      {anyConnected && (
        <p className="text-[12px] text-muted border-t border-[#F1F1F1] pt-3">
          {autoPublish
            ? "Posts publish automatically at their scheduled time to whichever connected platforms they target."
            : "Auto-publish is off — you'll get reminders. Use “Publish now” on a post to send it immediately."}
          {" "}LinkedIn tokens last ~60 days; reconnect when it says expired.
        </p>
      )}

      {flash && <p className={`text-[13px] font-semibold ${flash.kind === "ok" ? "text-olive" : "text-danger"}`}>{flash.text}</p>}
    </div>
  );
}
