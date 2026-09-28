// Adapted from botstories-web: keep the existing Node test environment and aliases.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    maxWorkers: 1,
  },
});
