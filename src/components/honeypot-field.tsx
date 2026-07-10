import { HONEYPOT_FIELD } from "@/lib/honeypot";

// An off-screen, aria-hidden, non-tabbable text input that real users never see
// or fill, but naive spam bots populate. Server actions reject any submission
// where this comes back non-empty. Drop it inside any public <form>.
export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
    >
      <label>
        Leave this field empty
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
