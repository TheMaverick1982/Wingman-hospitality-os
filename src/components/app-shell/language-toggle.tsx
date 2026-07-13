"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { setLanguage } from "@/app/(app)/language-actions";

// Compact language switcher for the top bar. Persists the choice to the
// profile and refreshes so translated surfaces re-render.
export function LanguageToggle({ current }: { current: Lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(value: string) {
    if (value === current) return;
    start(async () => {
      await setLanguage(value);
      router.refresh();
    });
  }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-[7px] rounded-full border border-line hover:bg-paper transition-colors ${pending ? "opacity-60" : ""}`}>
      <Languages size={13} className="text-muted-2" />
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        aria-label="Language"
        className="text-[13px] font-semibold bg-transparent outline-none pr-1 text-charcoal-2"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
