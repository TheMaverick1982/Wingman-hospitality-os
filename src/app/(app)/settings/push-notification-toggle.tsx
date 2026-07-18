"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { savePushSubscription, removePushSubscription, sendTestPush } from "./push-actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false); // iOS: must install PWA first
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID_PUBLIC_KEY;
      setSupported(ok);
      setNeedsInstall(ios && !standalone);
      if (!ok) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function enable() {
    setMsg(null);
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMsg("Notifications are blocked in your browser settings.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
        const res = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
        if (res.error) {
          setMsg(res.error);
          return;
        }
        setSubscribed(true);
        setMsg("Notifications enabled on this device.");
      } catch (e) {
        setMsg((e as Error).message || "Couldn't enable notifications.");
      }
    });
  }

  function disable() {
    setMsg(null);
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        setMsg("Notifications turned off on this device.");
      } catch (e) {
        setMsg((e as Error).message || "Couldn't turn off notifications.");
      }
    });
  }

  function test() {
    setMsg(null);
    start(async () => {
      const res = await sendTestPush();
      setMsg(res.error ?? "Sent — check your notifications.");
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
          <BellRing size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Push notifications</div>
          <p className="text-sm text-muted mt-0.5">Get Wingman alerts on this device — even when the app isn&rsquo;t open. Enable per device.</p>
        </div>
      </div>

      {!supported ? (
        <p className="text-[13px] text-muted-2">
          {needsInstall
            ? "On iPhone/iPad, add Wingman to your home screen first (Share → Add to Home Screen), then open it from there to enable notifications."
            : "This browser doesn't support push notifications."}
        </p>
      ) : (
        <div className="flex items-center gap-2.5 flex-wrap">
          {subscribed ? (
            <>
              <button onClick={disable} disabled={pending} className="text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-4 py-2 hover:bg-white transition-colors disabled:opacity-50">
                Turn off on this device
              </button>
              <button onClick={test} disabled={pending} className="text-[13px] font-semibold text-brick hover:opacity-70 transition-opacity disabled:opacity-50">
                Send a test
              </button>
            </>
          ) : (
            <button onClick={enable} disabled={pending} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors disabled:opacity-50">
              Enable on this device
            </button>
          )}
          {msg && <span className="text-[12.5px] text-muted-2">{msg}</span>}
        </div>
      )}
    </div>
  );
}
