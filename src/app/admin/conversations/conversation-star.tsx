"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleConversationStar } from "./actions";

export function ConversationStar({ contactId, starred: initial, size = 16 }: { contactId: string; starred: boolean; size?: number }) {
  const [starred, setStarred] = useState(initial);
  const [, start] = useTransition();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !starred;
        setStarred(next); // optimistic
        start(() => {
          toggleConversationStar(contactId, next);
        });
      }}
      aria-label={starred ? "Unstar conversation" : "Star conversation"}
      title={starred ? "Starred" : "Star"}
      className="shrink-0 text-muted-2 hover:text-amber-400 transition-colors"
    >
      <Star size={size} className={starred ? "fill-amber-400 text-amber-400" : ""} />
    </button>
  );
}
