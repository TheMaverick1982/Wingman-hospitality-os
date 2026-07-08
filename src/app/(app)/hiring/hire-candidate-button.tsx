"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { hireCandidate } from "./actions";

export function HireCandidateButton({ candidateId, alreadyHired }: { candidateId: string; alreadyHired: boolean }) {
  const [done, setDone] = useState(alreadyHired);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <span className="flex items-center gap-1">
        <Pill tone="olive">
          <Check size={11} /> On staff
        </Pill>
      </span>
    );
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const result = await hireCandidate(candidateId);
          if (!result.error) {
            setDone(true);
            router.refresh();
          }
        })
      }
      disabled={pending}
      className="flex items-center gap-1.5 text-xs font-semibold text-brick hover:underline disabled:opacity-50"
    >
      <UserPlus size={13} /> {pending ? "Adding..." : "Add to staff"}
    </button>
  );
}
