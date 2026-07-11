import Link from "next/link";

// Shown across the whole app for demo/sandbox orgs (gated on profile.isDemo in
// the app layout). Persistently visible — like the impersonation banner it sits
// above the scroll area — to nudge the visitor from "just looking" to signing
// up while they're impressed. The signup link carries the email they gave at the
// demo gate so their real workspace is one step away.
export function DemoBanner({ email }: { email?: string | null }) {
  const href = email ? `/signup?email=${encodeURIComponent(email)}` : "/signup";
  return (
    <div className="bg-brick text-white px-5 py-2.5 flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0 truncate">
        <span aria-hidden>✨ </span>
        You&apos;re exploring a live demo — <span className="hidden sm:inline">poke around all you like, </span>
        nothing here is saved.
      </span>
      <Link
        href={href}
        className="shrink-0 inline-flex items-center gap-1.5 font-semibold bg-white text-brick rounded-full px-3.5 py-1 hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        Create your account →
      </Link>
    </div>
  );
}
