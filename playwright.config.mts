import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.CI ? undefined : "chrome",
    // Authentication artifacts can contain credentials; don't record them.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
