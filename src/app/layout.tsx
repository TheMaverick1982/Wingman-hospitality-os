import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wingman",
  description: "Guest experience, culture, and accountability for hospitality teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">{children}</body>
    </html>
  );
}
