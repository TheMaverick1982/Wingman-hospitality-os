"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "@/components/ui/field";

// Password field with a show/hide toggle. Drop-in replacement for a raw
// `<input type="password" className={inputClass} />` — pass the same props
// (name, placeholder, required, …). The eye button flips the input between
// masked and plain text so people can check what they typed instead of
// guessing, which cuts failed logins from typos. `baseClass` lets callers on a
// different input style (e.g. the affiliate portal) reuse the same control.
export function PasswordInput({
  baseClass = inputClass,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { baseClass?: string }) {
  const [show, setShow] = useState(false);
  const inputId = useId();

  return (
    <div className="relative">
      <input
        {...props}
        id={props.id ?? inputId}
        type={show ? "text" : "password"}
        // Reserve room on the right so long input never slides under the eye.
        className={`${baseClass} pr-11 ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        // Skip in tab order so email → password → submit stays natural.
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-2 hover:text-ink transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
