import { test, expect } from "@playwright/test";

test("the exported demo works under its CSP and has no private application or backend", async ({ page, request, baseURL }, testInfo) => {
  expect(["http://127.0.0.1:3101", "https://supabase-ai-story-reference.vercel.app"]).toContain(baseURL);
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", req => { if (new URL(req.url()).origin !== baseURL) external.push(req.url()); });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (/Content Security Policy/i.test(message.text())) errors.push(message.text()); });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("'sha256-");
  expect(response?.headers()["content-security-policy"]).not.toMatch(/unsafe-inline|unsafe-eval/);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/nshaikh3/supabase-ai-story-reference");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "View demo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A map in the moonlight" })).toBeVisible();
  for (let chapter = 2; chapter <= 5; chapter++) {
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByText(`Chapter ${chapter} of 5`, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Read again", exact: true }).click();
  await expect(page.getByText("Chapter 1 of 5", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Explore the architecture →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One story. Clear boundaries." })).toBeVisible();
  expect((await page.reload())?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "One story. Clear boundaries." })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  for (const path of ["/sign-in", "/sign-up", "/dashboard", "/account", "/stories/new", "/assets/example", "/auth/callback", "/.env.local", "/supabase/config.toml"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  expect((await request.post("/demo", { headers: { "Next-Action": "invalid" }, data: "[]" })).status()).toBe(405);
});
