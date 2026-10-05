import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { loadConfig } from "../../scripts/local-config.mjs";
import { createSyntheticAccount } from "./helpers.mjs";
import type { Database } from "../../types/database";

const api = "http://127.0.0.1:55321";
function client(token?: string) {
  loadConfig();
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (env.NEXT_PUBLIC_SUPABASE_URL !== api || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) throw new Error("Refusing non-reference client");
  return createClient<Database>(api, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

test("story CRUD, private byte access, cross-owner denial and recoverable uploads", async ({ page, request, browser }) => {
  test.setTimeout(240_000);
  const alice = await createSyntheticAccount(page, request);
  const a = client(alice.access_token);
  const otherContext = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const otherPage = await otherContext.newPage();
  const bob = await createSyntheticAccount(otherPage, request);
  const b = client(bob.access_token);
  const anonymous = client();
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#328568" } }).png().toBuffer();

  try {
  await page.getByRole("link", { name: "Open my stories" }).click();
  await expect(page.getByRole("heading", { name: "My stories", exact: true })).toBeVisible();
  await expect(page.getByText("Your first adventure awaits")).toBeVisible();
  await page.getByRole("link", { name: "New story", exact: true }).click();
  await page.getByLabel("Story title").fill("   ");
  await page.getByLabel("Hero’s first name").fill("Nova");
  await page.getByLabel("Story idea").fill("A fictional explorer follows the moonlight map.");
  await page.getByRole("button", { name: "Create story", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Enter a title");
  await expect(page.getByLabel("Story idea")).toHaveValue("A fictional explorer follows the moonlight map.");
  await page.getByLabel("Story title").fill("The moonlight map");
  await page.getByRole("button", { name: "Create story", exact: true }).click();
  await expect(page).toHaveURL(/\/stories\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: "The moonlight map", exact: true })).toBeVisible();
  await page.getByLabel("Story title").fill("The moonlight map, revised");
  await page.getByRole("button", { name: "Save story details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Story details saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Story title")).toHaveValue("The moonlight map, revised");
  await page.getByLabel("Hero image", { exact: true }).setInputFiles({ name: "spoof.png", mimeType: "image/png", buffer: Buffer.from("<svg>not raster pixels</svg>") });
  await page.getByRole("button", { name: "Upload hero image" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("couldn’t read that image");
  await page.getByLabel("Hero image", { exact: true }).setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload hero image" }).click();
  await expect(page.getByRole("img", { name: "Your story’s hero illustration" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Hero image uploaded" })).toBeVisible();
  const { data: asset, error: assetError } = await a.from("assets").select("id,storage_path").eq("story_id", id).single();
  expect(assetError).toBeNull(); if (!asset) throw new Error("Missing owned asset");
  await expect(page.getByRole("img", { name: "Your story’s hero illustration" })).toHaveJSProperty("complete", true);
  await expect(page.getByRole("img", { name: "Your story’s hero illustration" })).toHaveJSProperty("naturalWidth", 320);
  // Deliberate visual fixtures contain only fictional story data, no Auth forms.
  await page.screenshot({ path: "test-results/phase3-story-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("body").evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/phase3-story-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const imageResponse = await page.request.get(`/assets/${asset.id}`);
  expect(imageResponse.status()).toBe(200); expect(imageResponse.headers()["cache-control"]).toContain("no-store"); expect(imageResponse.headers()["content-type"]).toBe("image/webp"); expect(imageResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await request.get(`/assets/${asset.id}`)).status()).toBe(404);
  expect((await otherPage.request.get(`/assets/${asset.id}`)).status()).toBe(404);
  await otherPage.goto(`/stories/${id}`);
  await expect(otherPage.getByRole("heading", { name: "Story unavailable" })).toBeVisible();
  expect((await b.from("stories").select("id").eq("id", id)).data).toEqual([]);
  expect((await b.from("stories").update({ title: "Forged" }).eq("id", id).select("id")).data).toEqual([]);
  expect((await b.from("stories").delete().eq("id", id).select("id")).data).toEqual([]);
  expect((await b.storage.from("story-assets").download(asset.storage_path)).error).not.toBeNull();
  expect((await anonymous.storage.from("story-assets").download(asset.storage_path)).error).not.toBeNull();
  expect((await request.get(`${api}/storage/v1/object/public/story-assets/${asset.storage_path}`)).ok()).toBe(false);
  expect((await b.storage.from("story-assets").upload(asset.storage_path, png, { contentType: "image/png" })).error).not.toBeNull();
  await b.storage.from("story-assets").remove([asset.storage_path]);
  await anonymous.storage.from("story-assets").remove([asset.storage_path]);
  expect((await a.storage.from("story-assets").download(asset.storage_path)).error).toBeNull();
  expect((await a.storage.from("story-assets").upload(asset.storage_path, png, { contentType: "image/png", upsert: true })).error).not.toBeNull();
  expect((await a.from("assets").delete().eq("id", asset.id)).error).not.toBeNull();
  expect((await a.from("stories").delete().eq("id", id)).error).not.toBeNull();

  // Real bucket MIME/byte limits and display validation for a direct API caller.
  const { data: second, error: secondError } = await a.from("stories").insert({ title: "Interrupted upload fixture", child_name: "Mica", prompt: "Synthetic reference fixture" }).select("id").single();
  expect(secondError).toBeNull(); if (!second) throw new Error("Missing recovery fixture");
  const path = `${alice.user.id}/${second.id}/${randomUUID()}.png`;
  const { data: reservation, error: reservationError } = await a.from("assets").insert({ story_id: second.id, kind: "hero", storage_path: path, mime_type: "image/png" }).select("id").single();
  expect(reservationError).toBeNull(); if (!reservation) throw new Error("Missing recovery reservation");
  expect((await a.storage.from("story-assets").upload(path, "<svg/>", { contentType: "image/svg+xml" })).error).not.toBeNull();
  expect((await a.storage.from("story-assets").upload(path, Buffer.alloc(2 * 1024 * 1024 + 1), { contentType: "image/png" })).error).not.toBeNull();
  expect((await a.storage.from("story-assets").upload(path, "<svg/>", { contentType: "image/png" })).error).toBeNull();
  expect((await page.request.get(`/assets/${reservation.id}`)).status()).toBe(404);
  await page.goto(`/stories/${second.id}`);
  await expect(page.getByText("The image is unavailable or the upload was interrupted.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Remove hero image" }).click();
  await expect(page.getByLabel("Hero image", { exact: true })).toBeVisible();
  expect((await a.storage.from("story-assets").download(path)).error).not.toBeNull();
  expect((await a.from("assets").select("id").eq("id", reservation.id)).data).toEqual([]);
  // An empty reservation (process stopped before upload) is removable too.
  const { error: emptyError } = await a.from("assets").insert({ story_id: second.id, kind: "hero", storage_path: path, mime_type: "image/png" });
  expect(emptyError).toBeNull(); await page.reload();
  await page.getByRole("button", { name: "Remove hero image" }).click();
  await expect(page.getByLabel("Hero image", { exact: true })).toBeVisible();
  await page.getByLabel("I understand this cannot be undone.").check();
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?deleted=1$/);

  await page.goto(`/stories/${id}`);
  await page.getByLabel("I understand this cannot be undone.").check();
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("Story deleted");
  expect((await a.from("stories").select("id").eq("id", id)).data).toEqual([]);
  expect((await a.from("assets").select("id").eq("id", asset.id)).data).toEqual([]);
  expect((await a.storage.from("story-assets").download(asset.storage_path)).error).not.toBeNull();
  expect((await page.request.get(`/assets/${asset.id}`)).status()).toBe(404);

  // Pagination remains reachable beyond the Data API's default response limits.
  const { data: fixtures, error: fixtureError } = await a.from("stories").insert(Array.from({ length: 21 }, (_, i) => ({ title: `Pagination fixture ${i}`, child_name: "Nova", prompt: "Fictional pagination test" }))).select("id");
  expect(fixtureError).toBeNull(); await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Pagination fixture/ })).toHaveCount(20);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByRole("link", { name: /^Pagination fixture/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Previous page" })).toBeVisible();
  expect((await a.from("stories").delete().in("id", (fixtures ?? []).map(item => item.id))).error).toBeNull();
  } finally {
    // Clean up bytes even when an assertion fails; DB reset alone is insufficient.
    const { data: leftovers, error } = await a.from("assets").select("storage_path");
    expect(error, "Synthetic image cleanup inventory is readable").toBeNull();
    if (leftovers?.length) {
      const removed = await a.storage.from("story-assets").remove(leftovers.map(asset => asset.storage_path));
      expect(removed.error, "Synthetic image bytes are removed before reset").toBeNull();
    }
    expect((await a.from("stories").delete().eq("owner_id", alice.user.id)).error).toBeNull();
    await otherContext.close();
  }
});
