import type { MetadataRoute } from "next";

// Web App Manifest -- makes Wingman installable to the home screen and defines
// how it presents when launched as a standalone app (and later, inside the
// Capacitor native shell). Next serves this at /manifest.webmanifest and links
// it automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wingman — Hospitality OS",
    short_name: "Wingman",
    description:
      "The culture, training, and accountability system hospitality teams actually use, every shift.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#0a6cff",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
