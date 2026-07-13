"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Last-resort boundary: catches errors thrown in the root layout itself. It
// replaces the whole document, so it must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif", background: "#faf8f5", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #ececec", borderRadius: 20, padding: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#737373", margin: "0 0 24px", lineHeight: 1.5 }}>
              We&rsquo;ve been notified automatically. Please try again.
            </p>
            <button
              onClick={reset}
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "#0a6cff", border: "none", borderRadius: 999, padding: "10px 20px", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
