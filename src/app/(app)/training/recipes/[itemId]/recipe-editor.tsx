"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Camera, ImageOff, Loader2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import type { RecipeStep } from "@/lib/data/recipes";
import {
  addRecipeStep,
  updateRecipeStepText,
  deleteRecipeStep,
  moveRecipeStep,
  uploadRecipeStepImage,
  removeRecipeStepImage,
} from "../actions";

// Shrink a phone photo to a small WebP in the browser before it's ever uploaded,
// so storage stays lean (a 5 MB photo becomes ~150–250 KB) and uploads are fast.
async function resizeToWebp(file: File, maxDim = 1400, quality = 0.75): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => createImageBitmap(file));
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", quality));
  if (!blob) return file;
  return new File([blob], "step.webp", { type: "image/webp" });
}

export function RecipeEditor({ menuItemId, steps, canEdit }: { menuItemId: string; steps: RecipeStep[]; canEdit: boolean }) {
  const [pending, start] = useTransition();

  if (steps.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
        <p className="text-[15px] font-semibold text-ink">No recipe yet.</p>
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          {canEdit
            ? "Add the steps to make this dish — number them in order and snap a photo of each. Your line cooks pull these up mid-service."
            : "A manager hasn't added the steps for this dish yet."}
        </p>
        {canEdit && (
          <div className="mt-4 flex justify-center">
            <Btn icon={Plus} onClick={() => start(() => addRecipeStep(menuItemId))} disabled={pending}>
              Add the first step
            </Btn>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          index={i}
          total={steps.length}
          menuItemId={menuItemId}
          canEdit={canEdit}
        />
      ))}
      {canEdit && (
        <div>
          <Btn kind="ghost" icon={Plus} onClick={() => start(() => addRecipeStep(menuItemId))} disabled={pending}>
            Add step
          </Btn>
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  total,
  menuItemId,
  canEdit,
}: {
  step: RecipeStep;
  index: number;
  total: number;
  menuItemId: string;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState(step.instruction);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const resized = await resizeToWebp(file);
      const fd = new FormData();
      fd.set("stepId", step.id);
      fd.set("menuItemId", menuItemId);
      fd.set("file", resized);
      await uploadRecipeStepImage({ error: null }, fd);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-brick text-white flex items-center justify-center text-sm font-bold shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {/* Photo */}
          {step.imageUrl ? (
            <div className="relative mb-3 rounded-xl overflow-hidden border border-line max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.imageUrl} alt={`Step ${index + 1}`} className="w-full h-auto block" />
              {canEdit && (
                <button
                  onClick={() => start(() => removeRecipeStepImage(step.id, menuItemId))}
                  disabled={pending}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-black/55 rounded-full px-2.5 py-1 hover:bg-black/70 disabled:opacity-50"
                >
                  <ImageOff size={12} /> Remove
                </button>
              )}
            </div>
          ) : (
            canEdit && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mb-3 inline-flex items-center gap-2 text-[13px] font-semibold text-brick border border-dashed border-brick/40 rounded-xl px-4 py-3 hover:bg-brick-tint disabled:opacity-50"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {uploading ? "Uploading…" : "Add a photo"}
              </button>
            )
          )}
          {canEdit && step.imageUrl && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mb-3 -mt-1 block text-[12px] font-semibold text-muted-2 hover:text-ink disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace photo"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" />

          {/* Instruction */}
          {canEdit ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (text !== step.instruction) start(() => updateRecipeStepText(step.id, text, menuItemId));
              }}
              placeholder="Describe this step…"
              rows={2}
              className="w-full text-[14px] text-ink rounded-lg border border-line px-3 py-2 resize-y focus:outline-none focus:border-brick"
            />
          ) : (
            <p className="text-[15px] text-charcoal-2 leading-relaxed whitespace-pre-wrap">{step.instruction || "—"}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <button
              onClick={() => start(() => moveRecipeStep(step.id, "up", menuItemId))}
              disabled={pending || index === 0}
              className="text-muted-2 hover:text-ink disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp size={15} />
            </button>
            <button
              onClick={() => start(() => moveRecipeStep(step.id, "down", menuItemId))}
              disabled={pending || index === total - 1}
              className="text-muted-2 hover:text-ink disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown size={15} />
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this step?")) start(() => deleteRecipeStep(step.id, menuItemId));
              }}
              disabled={pending}
              className="text-muted-2 hover:text-danger disabled:opacity-50 mt-1"
              aria-label="Delete step"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
