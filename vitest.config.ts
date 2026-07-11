import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Match the "@/..." path alias used across the app.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" is a build-time marker with no runtime; stub it for tests.
      "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
