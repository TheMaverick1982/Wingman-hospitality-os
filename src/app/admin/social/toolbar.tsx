"use client";

import { useRef, useState } from "react";
import { Composer } from "./composer";
import { createClient } from "@/lib/supabase/client";
import { SOCIAL_BUCKET, MAX_IMAGE_BYTES } from "@/lib/social";
import { importPosts, signSocialUploads } from "./actions";

const SAMPLE = `[
  {
    "caption": "You pay to win a guest once — then lose them out the bottom.",
    "first_comment": "#restauranttech #hospitality",
    "link": "https://www.joinwingman.app/demo",
    "platforms": ["instagram", "facebook"],
    "scheduled_at": "2026-07-15T09:00:00-04:00",
    "image": "post1.png"
  }
]`;

function ImportPanel({ onDone }: { onDone: () => void }) {
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; error: string | null } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const json = jsonRef.current?.value ?? "";
    if (!json.trim()) {
      setResult({ ok: false, error: "Paste a JSON plan first." });
      return;
    }
    const files = Array.from(filesRef.current?.files ?? []);
    setBusy(true);
    try {
      const pathMap: Record<string, string> = {};
      if (files.length) {
        const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
        if (tooBig) {
          setResult({ ok: false, error: `"${tooBig.name}" is over 50MB — compress it and try again.` });
          return;
        }
        // Upload each file straight to storage from the browser (no server body
        // limit) using short-lived signed upload URLs.
        setProgress(`Uploading 0/${files.length}…`);
        const targets = await signSocialUploads(files.map((f) => f.name));
        const byName = new Map(targets.map((t) => [t.name, t]));
        const supabase = createClient();
        let done = 0;
        for (const f of files) {
          const t = byName.get(f.name);
          if (t) {
            const { error } = await supabase.storage.from(SOCIAL_BUCKET).uploadToSignedUrl(t.path, t.token, f, { contentType: f.type });
            if (error) {
              setResult({ ok: false, error: `Upload failed for "${f.name}": ${error.message}` });
              return;
            }
            pathMap[f.name.toLowerCase()] = t.path;
          }
          done++;
          setProgress(`Uploading ${done}/${files.length}…`);
        }
      }
      setProgress("Creating posts…");
      const res = await importPosts(json, JSON.stringify(pathMap));
      setResult(res);
      if (res.ok && !res.error) onDone();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Paste the JSON plan from Claude Design and select all its image files below — each post&rsquo;s{" "}
        <code>image</code> (or <code>images</code>) filename is matched to the files, so everything lands ready. Images upload
        straight to storage from your browser, so a big batch is fine.
      </p>
      <textarea
        ref={jsonRef}
        rows={9}
        placeholder={SAMPLE}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none focus:border-brick font-mono leading-relaxed"
      />
      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Image files (select all of them at once)</label>
        <input
          ref={filesRef}
          type="file"
          multiple
          accept="image/*,video/mp4"
          className="block w-full text-[13px] text-charcoal-2 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-line"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50"
        >
          {busy ? progress ?? "Importing…" : "Import posts"}
        </button>
        <button type="button" onClick={onDone} className="text-[14px] text-muted-2 hover:text-ink">
          Cancel
        </button>
        {result?.ok && result.error && <span className="text-[13px] text-[#b4884a]">Imported{result.error}</span>}
        {result && !result.ok && result.error && <span className="text-[14px] text-danger">{result.error}</span>}
      </div>
    </form>
  );
}

export function SocialToolbar({ connected }: { connected: boolean }) {
  const [open, setOpen] = useState<"none" | "new" | "import">("none");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? "none" : "new")}
          className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
        >
          + New post
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "import" ? "none" : "import")}
          className="text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-5 py-2.5 hover:border-brick hover:text-brick transition-colors"
        >
          Import from Claude Design
        </button>
      </div>

      {open === "new" && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <Composer onDone={() => setOpen("none")} connected={connected} />
        </div>
      )}
      {open === "import" && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <ImportPanel onDone={() => setOpen("none")} />
        </div>
      )}
    </div>
  );
}
