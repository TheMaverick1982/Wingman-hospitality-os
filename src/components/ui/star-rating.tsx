"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function StarRating({ name, defaultValue = 3 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex gap-1">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(n)}
          className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
          style={{ background: value >= n ? "var(--color-gold)" : "#f1f1f1" }}
        >
          <Star size={11} color={value >= n ? "#fff" : "#a3a3a3"} fill={value >= n ? "#fff" : "none"} />
        </button>
      ))}
    </div>
  );
}
