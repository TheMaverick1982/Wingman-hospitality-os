import { isNativeIOS } from "@/lib/native/platform";
import { LoginClient } from "./login-client";

// Server wrapper: resolves whether we're inside the native iOS app (via the
// user-agent token) so the login screen can render its App Review-compliant,
// login-only variant with no client flash. Web is unaffected.
export default async function LoginPage() {
  return <LoginClient nativeIOS={await isNativeIOS()} />;
}
