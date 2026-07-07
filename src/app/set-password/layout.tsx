import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Your Password",
  robots: { index: false, follow: false },
};

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
