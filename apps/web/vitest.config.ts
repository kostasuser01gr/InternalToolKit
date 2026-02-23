import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    reporters: "default",
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "@convex": fileURLToPath(new URL("../../convex", import.meta.url)),
    },
  },
});

