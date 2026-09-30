import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createSyntheticAccount } from "./helpers.mjs";
import { loadConfig } from "../../scripts/local-config.mjs";
import type { Database } from "../../types/database";
const api = "http://127.0.0.1:55321";

test("Edge authentication, owner isolation, duplicate generation and five-page UI", async ({ page, request, browser }) => {
  test.setTimeout(240_000);
  loadConfig();
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (env.NEXT_PUBLIC_SUPABASE_URL !== api) throw new Error("Refusing non-reference API");
  // Paid providers are never invoked by the integration suite.
  if (parseEnv(readFileSync("supabase/functions/.env", "utf8")).AI_PROVIDER !== "mock") throw new Error("Generation E2E requires AI_PROVIDER=mock");
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publicKey?.startsWith("sb_publishable_")) throw new Error("Missing local publishable key");
  const key: string = publicKey;
  const alice = await createSyntheticAccount(page, request);
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const bob = await createSyntheticAccount(await context.newPage(), request);
  const makeClient = (token: string) => createClient<Database>(api, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const a = makeClient(alice.access_token), b = makeClient(bob.access_token);
  const invoke = async (body: unknown, token?: string) => {
    try { return await request.post(`${api}/functions/v1/generate-story`, { headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, data: body, timeout: 60_000 }); }
    catch { throw new Error("Local Edge invocation failed before an HTTP response. Inspect reference service health."); }
  };
  try {
    const { data: story, error } = await a.from("stories").insert({ title: "Nova and the silver compass", child_name: "Nova", prompt: "A friendly explorer helps a fox in a moonlit garden." }).select("id").single();
    expect(error).toBeNull(); if (!story) throw Error("Missing test story");
    expect((await invoke({ story_id: story.id })).status()).toBe(401);
    expect((await invoke({ story_id: story.id }, "forged.jwt.value")).status()).toBe(401);
    expect((await invoke({ story_id: story.id }, bob.access_token)).status()).toBe(404);
    expect((await invoke({ story_id: "00000000-0000-4000-8000-000000000000" }, alice.access_token)).status()).toBe(404);
    expect((await invoke({ story_id: story.id, provider: "gemini" }, alice.access_token)).status()).toBe(400);
    expect((await a.rpc("claim_generation", { p_job_id: story.id, p_provider: "mock" })).error?.code).toBe("42501");
    expect((await a.rpc("finish_generation", { p_job_id: story.id, p_pages: [] })).error?.code).toBe("42501");
    await page.goto(`/stories/${story.id}`);
    const stalePage = await page.context().newPage();
    await stalePage.goto(`/stories/${story.id}`);
    await page.getByRole("button", { name: "Generate story", exact: true }).click();
    await expect(page.getByRole("region", { name: "Story pages" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Story pages" }).getByRole("heading", { name: /^Page / })).toHaveCount(5);
    await expect(page.getByRole("region", { name: "Generation history" })).toContainText("complete · mock");
    await expect(page.getByRole("button", { name: "Save story details" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("region", { name: "Story pages" })).toBeVisible();
    await stalePage.getByRole("button", { name: "Generate story", exact: true }).click();
    await expect(stalePage.getByRole("region", { name: "Story pages" })).toBeVisible();
    await expect(stalePage.getByRole("button", { name: "Generate story", exact: true })).toHaveCount(0);
    await stalePage.close();
    expect((await invoke({ story_id: story.id }, alice.access_token)).status()).toBe(200);
    expect((await a.from("generation_jobs").select("id").eq("story_id", story.id)).data).toHaveLength(1);
    expect((await a.from("story_pages").select("id").eq("story_id", story.id)).data).toHaveLength(5);
    expect((await b.from("generation_jobs").select("id").eq("story_id", story.id)).data).toEqual([]);
    expect((await b.from("story_pages").select("id").eq("story_id", story.id)).data).toEqual([]);
    await page.screenshot({ path: "test-results/phase4-generation-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/phase4-generation-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Competing real HTTP invocations must converge to one job and one page set.
    const next = await a.from("stories").insert({ title: "Concurrent request", child_name: "Nova", prompt: "A cloud library" }).select("id").single();
    if (!next.data) throw Error("Missing concurrency fixture");
    const replies = await Promise.all(Array.from({ length: 3 }, () => invoke({ story_id: next.data!.id }, alice.access_token)));
    expect(replies.every(reply => [200, 202].includes(reply.status()))).toBe(true);
    expect((await a.from("generation_jobs").select("id,status").eq("story_id", next.data.id)).data).toMatchObject([{ status: "complete" }]);
    expect((await a.from("story_pages").select("id").eq("story_id", next.data.id)).data).toHaveLength(5);
  } finally {
    // This test creates no Storage objects. Cleanup is scoped to its synthetic user.
    const cleanup = await a.from("stories").delete().eq("owner_id", alice.user.id);
    expect(cleanup.error).toBeNull();
    await context.close();
  }
});
