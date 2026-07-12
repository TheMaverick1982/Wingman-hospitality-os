"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePost, type SocialFormState } from "./actions";
import { SOCIAL_PLATFORMS, type SocialPost } from "@/lib/social";

const initial: SocialFormState = { error: null, ok: false };

// Convert an ISO timestamp to the value a <input type="datetime-local"> wants,
// in the browser's local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function Composer({
  post,
  images,
  onDone,
}: {
  post?: SocialPost;
  images?: { path: string; url: string }[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(savePost, initial);
  const [keep, setKeep] = useState<string[]>((images ?? []).map((i) => i.path));
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state.ok, onDone]);

  const platforms = post?.platforms ?? ["instagram", "facebook"];

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Caption</label>
        <textarea
          name="caption"
          rows={5}
          defaultValue={post?.caption ?? ""}
          placeholder="Write the post caption…"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brick leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Platforms</label>
          <div className="flex gap-4 pt-1.5">
            {SOCIAL_PLATFORMS.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-[14px] text-ink cursor-pointer">
                <input type="checkbox" name="platforms" value={p.key} defaultChecked={platforms.includes(p.key)} className="accent-brick" />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Schedule for</label>
          <input
            type="datetime-local"
            name="scheduled_at"
            defaultValue={toLocalInput(post?.scheduled_at ?? null)}
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Link (optional)</label>
          <input
            name="link"
            defaultValue={post?.link ?? ""}
            placeholder="https://www.joinwingman.app/demo"
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">First comment (optional)</label>
          <input
            name="first_comment"
            defaultValue={post?.first_comment ?? ""}
            placeholder="#restauranttech #hospitality"
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick"
          />
        </div>
      </div>

      {/* Existing images (edit mode) with remove toggles. */}
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => {
            const kept = keep.includes(img.path);
            return (
              <div key={img.path} className="relative">
                {kept && <input type="hidden" name="kept_image" value={img.path} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className={`w-20 h-20 object-cover rounded-lg border border-line ${kept ? "" : "opacity-30"}`} />
                <button
                  type="button"
                  onClick={() => setKeep((cur) => (kept ? cur.filter((p) => p !== img.path) : [...cur, img.path]))}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink text-white text-[11px] leading-none flex items-center justify-center"
                  title={kept ? "Remove" : "Keep"}
                >
                  {kept ? "×" : "+"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">{images?.length ? "Add more images" : "Images / video"}</label>
        <input
          type="file"
          name="images"
          multiple
          accept="image/*,video/mp4"
          className="block w-full text-[13px] text-charcoal-2 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-line"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          name="intent"
          value="schedule"
          disabled={pending}
          className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Schedule"}
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="text-[15px] font-semibold text-charcoal-2 border border-line rounded-full px-6 py-2.5 hover:border-brick hover:text-brick transition-colors disabled:opacity-50"
        >
          Save draft
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="text-[14px] text-muted-2 hover:text-ink">
            Cancel
          </button>
        )}
        {state.error && <span className="text-[14px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
