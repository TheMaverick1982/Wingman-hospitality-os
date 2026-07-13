"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, Check } from "lucide-react";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";
import { setLanguage } from "@/app/(app)/language-actions";

// Shown once, on first login, before the user has picked a language. Defaults
// to English but lets a Spanish-speaking staffer switch right away. Bilingual
// copy so it's understandable regardless of the language they land in.
export function FirstLoginLanguage() {
  const router = useRouter();
  const [choice, setChoice] = useState<Lang>("en");
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      await setLanguage(choice);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-line w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="w-11 h-11 rounded-xl bg-brick-tint text-brick flex items-center justify-center">
          <Languages size={20} />
        </div>
        <div>
          <div className="text-[18px] font-bold tracking-[-0.01em] text-ink">
            {t("en", "lang.choose.title")} <span className="text-muted">· {t("es", "lang.choose.title")}</span>
          </div>
          <p className="text-[13.5px] text-muted mt-1">
            {t("en", "lang.choose.sub")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {LANGUAGES.map((l) => {
            const on = choice === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setChoice(l.code)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${on ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"}`}
              >
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${on ? "bg-brick border-brick text-white" : "border-line-strong text-transparent"}`}>
                  <Check size={13} />
                </span>
                <span className="text-[15px] font-semibold text-ink">{l.native}</span>
                {l.native !== l.label && <span className="text-[13px] text-muted">{l.label}</span>}
              </button>
            );
          })}
        </div>
        <button
          onClick={confirm}
          disabled={pending}
          className="w-full text-[15px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50"
        >
          {pending ? "…" : `${t(choice, "lang.continue")}`}
        </button>
      </div>
    </div>
  );
}
