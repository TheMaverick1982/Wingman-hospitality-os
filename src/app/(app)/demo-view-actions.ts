"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentProfile, DEMO_VIEW_COOKIE } from "@/lib/auth/profile";

// Flip the demo between the owner view and a staff view (as a Server or a Chef).
// Strictly a no-op outside a demo org, so a stray cookie can never downgrade a
// real account.
export async function setDemoView(role: "owner" | "server" | "chef") {
  const profile = await getCurrentProfile();
  if (!profile?.isDemo) return;

  const cookieStore = await cookies();
  if (role === "server" || role === "chef") {
    cookieStore.set(DEMO_VIEW_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours — comfortably longer than a demo session
    });
  } else {
    cookieStore.set(DEMO_VIEW_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  // Land on the dashboard so the switch is obvious and we never sit on a page the
  // new role can't see.
  redirect("/dashboard");
}
