import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createSyntheticAccount, sessionDiagnostics } from "./helpers.mjs";
import { loadConfig } from "../../scripts/local-config.mjs";
import type { Database } from "../../types/database";

const api = "http://127.0.0.1:55321";
async function join(client: SupabaseClient<Database>, topic: string, privateChannel: boolean, received: unknown[] = []) {
  const channel = client.channel(topic, { config: { private: privateChannel, broadcast: { ack: true } } });
  channel.on("broadcast", { event: "generation_status" }, message => received.push(message.payload));
  const status = await new Promise<string>(resolve => {
    const timer = setTimeout(() => resolve("TEST_TIMEOUT"), 45_000);
    channel.subscribe(state => {
      // A transient join timeout is retried by the SDK; preserve that behavior
      // within a finite test deadline. Authorization errors still fail at once.
      if (["SUBSCRIBED", "CHANNEL_ERROR"].includes(state)) { clearTimeout(timer); resolve(state); }
    });
  });
  return { channel, status };
}

test("private Broadcast authorization, live progress, reconnect and cross-tab sign-out", async ({ page, request, browser }) => {
  test.setTimeout(300_000);
  loadConfig();
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (env.NEXT_PUBLIC_SUPABASE_URL !== api || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) throw Error("Refusing non-reference API");
  if (parseEnv(readFileSync("supabase/functions/.env", "utf8")).AI_PROVIDER !== "mock") throw Error("Realtime E2E requires mock generation");
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const alice = await createSyntheticAccount(page, request);
  const bobContext = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const bob = await createSyntheticAccount(await bobContext.newPage(), request);
  const makeClient = (token?: string) => createClient<Database>(api, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  const a = makeClient(alice.access_token), b = makeClient(bob.access_token), anonymous = makeClient(), publicListener = makeClient();
  await a.realtime.setAuth(alice.access_token); await b.realtime.setAuth(bob.access_token);
  const invoke = async (id: string) => {
    let result;
    try {
      result = await request.post(`${api}/functions/v1/generate-story`, { headers: { apikey: key, Authorization: `Bearer ${alice.access_token}` }, data: { story_id: id }, timeout: 60_000 });
    } catch { throw Error("Reference mock generation transport failed before an HTTP response"); }
    // Keep HTTP diagnostics without exposing request headers or raw responses.
    expect(result.status(), "Reference mock generation HTTP status").toBe(200);
  };
  const createStory = async (title: string) => {
    const result = await a.from("stories").insert({ title, child_name: "Nova", prompt: "A kind fox explores a cloud library." }).select("id").single();
    expect(result.error).toBeNull(); if (!result.data) throw Error("Missing synthetic story"); return result.data.id;
  };
  try {
    const id = await createStory("Live cloud library");
    const received: unknown[] = [], publicReceived: unknown[] = [], rejectedReceived: unknown[] = [];
    const own = await join(a, `story:${id}`, true, received);
    expect(own.status).toBe("SUBSCRIBED");
    const other = await join(b, `story:${id}`, true, rejectedReceived);
    expect(other.status).toBe("CHANNEL_ERROR"); await b.removeChannel(other.channel);
    const anon = await join(anonymous, `story:${id}`, true, rejectedReceived);
    expect(anon.status).toBe("CHANNEL_ERROR"); await anonymous.removeChannel(anon.channel);
    const malformed = await join(b, "story:not-a-uuid", true);
    expect(malformed.status).toBe("CHANNEL_ERROR"); await b.removeChannel(malformed.channel);
    const missing = await join(b, "story:00000000-0000-4000-8000-000000000000", true);
    expect(missing.status).toBe("CHANNEL_ERROR"); await b.removeChannel(missing.channel);
    // Public topics may exist, but cannot receive private database broadcasts.
    const publicChannel = await join(publicListener, `story:${id}`, false, publicReceived);
    expect(publicChannel.status).toBe("SUBSCRIBED");
    const forged = { id: crypto.randomUUID(), story_id: id, job_id: crypto.randomUUID(), status: "complete" };
    expect(await own.channel.send({ type: "broadcast", event: "generation_status", payload: forged })).not.toBe("ok");

    await page.goto(`/stories/${id}`);
    try { await expect(page.getByTestId("live-connection")).toHaveText("Live updates connected"); }
    catch { throw new Error(`Private story navigation failed: ${await sessionDiagnostics(page, request, key, alice.access_token)}`); }
    const queued = await a.rpc("enqueue_generation", { p_story_id: id }); expect(queued.error).toBeNull();
    await expect(page.getByRole("status", { exact: false }).filter({ hasText: "Story request received" })).toBeVisible();
    await invoke(id);
    await expect(page.getByRole("region", { name: "Story pages" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Your story is ready" })).toBeVisible();
    await expect.poll(() => received.length).toBe(3);
    expect(received).toEqual(expect.arrayContaining(["queued", "generating", "complete"].map(status => expect.objectContaining({ story_id: id, status }))));
    for (const message of received) expect(Object.keys(message as object).sort()).toEqual(["id", "job_id", "status", "story_id"]);
    expect(publicReceived).toEqual([]); expect(rejectedReceived).toEqual([]);
    expect(received).not.toContainEqual(forged);

    const offlineId = await createStory("Catch up after reconnect");
    await page.goto(`/stories/${offlineId}`);
    await expect(page.getByTestId("live-connection")).toHaveText("Live updates connected");
    await page.context().setOffline(true);
    await expect(page.getByTestId("live-connection")).toContainText("disconnected");
    await invoke(offlineId);
    await page.context().setOffline(false);
    await expect(page.getByTestId("live-connection")).toHaveText("Live updates connected");
    await expect(page.getByRole("region", { name: "Story pages" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Story pages" }).getByRole("heading", { name: /^Page / })).toHaveCount(5);
    await page.screenshot({ path: "test-results/phase5-realtime-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/phase5-realtime-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Keep the private story mounted: deleting it first races the pending
    // reconciliation and unmounts the session listener on the not-found page.
    await expect(page.getByRole("region", { name: "Story pages" })).toBeVisible();
    const signOutTab = await page.context().newPage();
    await signOutTab.goto("/account");
    await signOutTab.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(signOutTab).toHaveURL(/\/sign-in\?message=signed-out/);
    await expect(page).toHaveURL(/\/sign-in\?message=session-changed/);
    await expect(page.getByRole("region", { name: "Story pages" })).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
    // Local logout revokes refresh sessions; this short-lived owner JWT remains
    // valid for scoped fixture cleanup until expiry (documented in SECURITY.md).
    expect((await a.from("stories").delete().eq("owner_id", alice.user.id)).error).toBeNull();
    await Promise.all([a, b, anonymous, publicListener].map(client => client.removeAllChannels()));
    await bobContext.close();
  }
});
