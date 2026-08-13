"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { markPosted, setStatus, deletePost, publishNow } from "./actions";
import { Composer } from "./composer";
import { CardRefine } from "./card-refine";
import { SOCIAL_PLATFORMS, isAssistedOnly, type SocialPost } from "@/lib/social";

type CardPost = SocialPost & { imageUrls: { path: string; url: string }[] };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

// Submit button that disables itself while its form's server action is running —
// stops a second click from firing a duplicate publish/mark-posted.
function SubmitButton({ className, pendingLabel, children }: { className: string; pendingLabel: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: "text-[#b4884a] bg-gold-tint",
  scheduled: "text-brick bg-brick-tint",
  posted: "text-olive bg-olive-tint",
  skipped: "text-muted bg-paper",
};

function whenLabel(iso: string | null): string {
  if (!iso) return "No date set";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PostCard({ post, connected }: { post: CardPost; connected: boolean }) {
  const [editing, setEditing] = useState(false);
  const platformLabels = post.platforms.map((p) => SOCIAL_PLATFORMS.find((x) => x.key === p)?.label ?? p).join(" · ");
  const liveUrls = Object.entries(post.published_urls ?? {}) as [string, string][];
  // The branded card graphic is only used on Facebook / Instagram (LinkedIn is
  // text-only). Offer graphic refinement while the post is still editable.
  const usesCard = post.status !== "posted" && post.platforms.some((p) => p === "facebook" || p === "instagram");

  if (editing) {
    return (
      <div className="bg-white border border-brick/40 rounded-2xl p-5 shadow-sm">
        <Composer post={post} images={post.imageUrls} onDone={() => setEditing(false)} connected={connected} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[post.status]}`}>{post.status}</span>
          {post.format !== "feed" && (
            <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full text-charcoal-2 bg-paper capitalize">{post.format}</span>
          )}
          <span className="text-[13px] text-muted">{platformLabels || "No platform"}</span>
        </div>
        <span className="text-[13px] font-semibold text-charcoal-2 shrink-0">{whenLabel(post.scheduled_at)}</span>
      </div>

      {post.imageUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {post.imageUrls.map((img) => (
            <a key={img.path} href={img.url} target="_blank" rel="noopener" title="Open full size" className="block rounded-xl overflow-hidden border border-line hover:border-brick transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-48 h-48 sm:w-56 sm:h-56 object-contain bg-paper" />
            </a>
          ))}
        </div>
      ) : post.images_purged_at ? (
        <p className="text-[12px] text-muted-2 italic">Images cleared to save space after posting.</p>
      ) : null}

      {post.caption && <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">{post.caption}</p>}
      {post.link && <a href={post.link} className="text-[13px] text-brick font-semibold break-all">{post.link}</a>}
      {post.first_comment && <p className="text-[13px] text-muted">1st comment: {post.first_comment}</p>}

      {liveUrls.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[13px]">
          {liveUrls.map(([platform, url]) => (
            <a key={platform} href={url} className="text-olive font-semibold capitalize">
              View on {platform} ↗
            </a>
          ))}
        </div>
      )}
      {post.publish_error && (
        <p className="text-[12px] text-danger bg-[#FDECEC] rounded-lg px-3 py-2">Publish failed — {post.publish_error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#F1F1F1] mt-1 pt-3">
        {post.caption && <CopyButton text={post.caption + (post.link ? `\n\n${post.link}` : "")} label="Copy caption" />}
        {post.first_comment && <CopyButton text={post.first_comment} label="Copy 1st comment" />}
        {post.imageUrls.map((img, i) => (
          <a
            key={img.path}
            href={img.url}
            download
            className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors"
          >
            Download{post.imageUrls.length > 1 ? ` ${i + 1}` : " image"}
          </a>
        ))}

        <div className="flex-1" />

        {post.status === "draft" && (
          <form action={setStatus} title={post.scheduled_at ? "" : "This draft has no date — it'll wait in Scheduled until you set one."}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="status" value="scheduled" />
            <SubmitButton
              pendingLabel="Approving…"
              className="text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors"
            >
              ✓ Approve
            </SubmitButton>
          </form>
        )}
        {connected && post.status !== "posted" && !isAssistedOnly(post.format) && (
          <form action={publishNow}>
            <input type="hidden" name="id" value={post.id} />
            <SubmitButton
              pendingLabel="Publishing…"
              className="text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors"
            >
              {post.publish_error ? "Retry publish" : "Publish now"}
            </SubmitButton>
          </form>
        )}
        {isAssistedOnly(post.format) && post.status !== "posted" && (
          <span className="text-[12px] text-[#b4884a] font-medium">Post in the IG app (add link sticker)</span>
        )}
        {post.status !== "posted" && (
          <form action={markPosted}>
            <input type="hidden" name="id" value={post.id} />
            <SubmitButton
              pendingLabel="Saving…"
              className="text-[13px] font-semibold text-white bg-olive rounded-full px-3.5 py-1.5 hover:opacity-90 transition-opacity"
            >
              Mark posted
            </SubmitButton>
          </form>
        )}
        {usesCard && <CardRefine postId={post.id} />}
        <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-charcoal-2 hover:text-brick px-2">
          Edit
        </button>
        {post.status === "scheduled" && (
          <form action={setStatus}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="status" value="skipped" />
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-ink px-2">
              Skip
            </button>
          </form>
        )}
        <form
          action={deletePost}
          onSubmit={(e) => {
            if (!confirm("Delete this post? This can't be undone.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
