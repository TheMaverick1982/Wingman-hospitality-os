"use client";

import { useState } from "react";
import { Code2, Check, Copy } from "lucide-react";

// Lets a consultant / partner / affiliate grab a copy-paste snippet to embed one
// of Wingman's free tools on their own site — every embed is a backlink. An
// optional referral code routes signups from that embed back to them (the
// incentive to place it). The snippet is a plain iframe + a tiny listener that
// resizes it to fit (the embedded page posts its height up — see EmbedResizer),
// so there's no inner scrollbar and no dependency to install.
const SITE = "https://www.joinwingman.app";

export function EmbedSnippet({
  toolName,
  embedPath,
  iframeTitle,
  messageKey,
  heightDefault = 1000,
}: {
  toolName: string; // e.g. "calculator", "scorecard"
  embedPath: string; // e.g. "/calculator/embed"
  iframeTitle: string; // the <iframe title="...">
  messageKey: string; // the postMessage key the EmbedResizer posts
  heightDefault?: number;
}) {
  const [ref, setRef] = useState("");
  const [copied, setCopied] = useState(false);

  const clean = ref.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const src = `${SITE}${embedPath}${clean ? `?ref=${clean}` : ""}`;
  const snippet = `<iframe src="${src}" title="${iframeTitle}" loading="lazy" style="width:100%;max-width:1080px;border:0;overflow:hidden" height="${heightDefault}"></iframe>
<script>
window.addEventListener("message",function(e){if(e&&e.data&&typeof e.data.${messageKey}==="number"){var f=document.querySelector('iframe[src*="joinwingman.app${embedPath}"]');if(f){f.style.height=e.data.${messageKey}+"px";}}});
</script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the textarea below is selectable as a fallback
    }
  }

  return (
    <div className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm text-left">
      <div className="flex items-center gap-2 mb-2">
        <Code2 size={18} className="text-brick" />
        <h3 className="font-display text-xl font-semibold text-ink">Add this free tool to your site</h3>
      </div>
      <p className="text-[15px] text-muted leading-relaxed mb-5 max-w-[640px]">
        Run a restaurant blog, consultancy, or resource page? Drop this {toolName} in with one snippet — it resizes to
        fit and gives your audience a genuinely useful tool. If you&rsquo;re a{" "}
        <a href="/affiliates" className="font-semibold text-brick hover:text-brick-dark">Wingman affiliate</a>, add your
        code and any signups it drives are credited to you.
      </p>

      <label className="block text-[13px] font-semibold text-ink mb-1.5">Your referral code <span className="font-normal text-muted-2">(optional)</span></label>
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="e.g. yourname"
        className="w-full max-w-[320px] rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors mb-4"
      />

      <div className="relative">
        <textarea
          readOnly
          value={snippet}
          rows={6}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-xl border border-line bg-[#FAFAFA] px-4 py-3 pr-24 text-[12.5px] font-mono text-charcoal-2 outline-none resize-none"
        />
        <button
          type="button"
          onClick={copy}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors"
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>
      <p className="text-[12.5px] text-muted-2 mt-2">Paste it into any HTML page or website builder that allows embed/HTML blocks.</p>
    </div>
  );
}
