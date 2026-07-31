import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isNativeIOS } from "@/lib/native/platform";
import { LoginClient } from "./login-client";

// Server wrapper: resolves whether we're inside the native iOS app (via the
// user-agent token) so the login screen can render its App Review-compliant,
// login-only variant with no client flash. Web is unaffected.
export default async function LoginPage() {
  // Already signed in with a workspace? Skip the form and go straight to the app.
  // On native iOS this is also where the marketing/registration gate lands a
  // signed-in reviewer, so forwarding them into the product keeps the login-only
  // shell from dead-ending at a login form they don't need.
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");
  return <LoginClient nativeIOS={await isNativeIOS()} />;
}
