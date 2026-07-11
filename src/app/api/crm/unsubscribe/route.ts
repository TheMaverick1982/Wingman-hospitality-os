import { type NextRequest } from "next/server";
import { suppressEmail, unsubSignature } from "@/lib/crm-sequences";

// One-click unsubscribe target from sequence emails. Verifies the HMAC in the
// link, adds the email to the suppression list, and stops their sequences.
function page(message: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f7;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
  <div style="background:#fff;border:1px solid #eee;border-radius:16px;padding:40px;max-width:420px;text-align:center;">
  <div style="font-size:16px;line-height:1.5;">${message}</div></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") || "").toLowerCase();
  const sig = url.searchParams.get("sig") || "";
  if (!email || !sig || sig !== unsubSignature(email)) {
    return page("This unsubscribe link is invalid or expired.");
  }
  try {
    await suppressEmail(email, "unsubscribed");
  } catch {
    return page("Something went wrong. Please email us and we'll take you off the list.");
  }
  return page("You've been unsubscribed. You won't receive any more emails from us.");
}
