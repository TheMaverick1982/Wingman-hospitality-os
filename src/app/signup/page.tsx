import { redirect } from "next/navigation";
import { isNativeIOS } from "@/lib/native/platform";
import { SignupClient } from "./signup-client";

// The native iOS app is login-only for App Review compliance (guideline 3.1.1 —
// no in-app account/organization registration). Owners create accounts on the
// web; inside the app we send anyone who reaches /signup to the login screen.
export default async function SignupPage() {
  if (await isNativeIOS()) redirect("/login");
  return <SignupClient />;
}
