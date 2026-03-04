import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    reporters: "default",
    pool: "forks",
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 30000,
    hookTimeout: 30000,
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
