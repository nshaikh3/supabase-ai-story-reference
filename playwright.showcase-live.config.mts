import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const publication = JSON.parse(readFileSync(new URL("./deployment/publication.json", import.meta.url), "utf8"));
// This acceptance target is the public static reference only. Never load private-app credentials.
if (publication.liveDemoUrl !== "https://supabase-ai-story-reference.vercel.app") {
  throw new Error("Live showcase verification requires the reviewed reference origin.");
}

export default defineConfig({
  testDir: "./tests/showcase", outputDir: "test-results/showcase-live", workers: 1, retries: 0,
  use: {
    baseURL: publication.liveDemoUrl,
    channel: process.env.CI ? undefined : "chrome",
    trace: "off", video: "off", screenshot: "off",
  },
});
