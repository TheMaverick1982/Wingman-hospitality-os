"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import type { ContactFormValue } from "./contact-modal";

// The iOS app is a WKWebView loading the live site. If the native build has no
// camera usage permission (NSCameraUsageDescription), invoking the camera-capture
// file input hard-crashes the whole app — so on such builds we skip the camera
// and show a message instead. Web + Android are unaffected.
function isNativeIOSClient(): boolean {
  try {
    const ua = navigator.userAgent || "";
    return ua.includes("WingmanNativeIOS") || document.cookie.includes("wm_native=ios");
  } catch {
    return false;
  }
}

// A rebuilt iOS binary that ships the camera permission appends this token to its
// user agent (capacitor.config.json → ios.appendUserAgent; see
// docs/mobile-app.md). We re-enable the camera only when it's present, so older
// permission-less builds that are still installed can never open it and crash.
function iosCameraCapable(): boolean {
  try {
    return (navigator.userAgent || "").includes("WingmanCam");
  } catch {
    return false;
  }
}

// Scanned fields the API returns. Mapped onto a new (id-less) contact so the
// Add Contact modal opens pre-filled for the manager to confirm.
type ScannedFields = Pick<ContactFormValue, "company_name" | "contact_name" | "title" | "email" | "phone" | "website" | "address">;

// A file input with `capture` opens the camera on mobile (and works inside the
// Capacitor webview too), so no native plugin is needed. The photo goes straight
// to the extractor and is never uploaded/stored.
export function ScanCardButton({
  defaultLocationId,
  onScanned,
}: {
  defaultLocationId: string | null;
  onScanned: (contact: ContactFormValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/partners/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mediaType: file.type || "image/jpeg" }),
      });
      const json = (await res.json()) as { fields?: ScannedFields; error?: string };
      if (!res.ok || !json.fields) {
        setErr(json.error ?? "Couldn't read that card.");
        return;
      }
      const f = json.fields;
      // Open the modal pre-filled (id "" = new). Manager confirms before saving.
      onScanned({
        id: "",
        location_id: defaultLocationId,
        company_name: f.company_name,
        contact_name: f.contact_name,
        title: f.title,
        email: f.email,
        phone: f.phone,
        category: "",
        subcategory: "",
        website: f.website,
        address: f.address,
        notes: "",
      });
    } catch {
      setErr("Card scanning is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-scanning the same file
          if (file) void handleFile(file);
        }}
      />
      <Btn
        kind="ghost"
        icon={Camera}
        loading={busy}
        onClick={() => {
          if (isNativeIOSClient() && !iosCameraCapable()) {
            setErr("Card scanning isn't available in the app yet — add them with Add Contact, or scan from the web dashboard.");
            return;
          }
          inputRef.current?.click();
        }}
      >
        {busy ? "Reading…" : "Scan Card"}
      </Btn>
      {err && <span className="text-xs text-brick self-center">{err}</span>}
    </>
  );
}
