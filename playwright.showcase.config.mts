import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/showcase", outputDir: "test-results-showcase", workers: 1, retries: 0,
  use: { baseURL: "http://127.0.0.1:3101", channel: process.env.CI ? undefined : "chrome", trace: "off", video: "on", screenshot: "off" },
  webServer: { command: "npm run preview:showcase", url: "http://127.0.0.1:3101", reuseExistingServer: false },
});
