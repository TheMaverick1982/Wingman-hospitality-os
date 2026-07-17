"use client";

import { useEffect } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { reportClientError } from "@/lib/report-client-error";

// Admin-segment error boundary: catches runtime errors on any /admin page,
// reports them to the monitor, and shows a calm recovery screen instead of
// bubbling to the root global-error (a blank crash).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-line rounded-[20px] p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-brick" />
        </div>
        <h1 className="text-[20px] font-bold text-ink mb-1.5">Something went wrong on this page</h1>
        <p className="text-[14px] text-muted mb-6">
          We&rsquo;ve been notified automatically and we&rsquo;re on it. Try again — it often just works on a second attempt.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
}
