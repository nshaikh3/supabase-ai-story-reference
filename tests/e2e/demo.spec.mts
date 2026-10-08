import { test, expect } from "@playwright/test";

test("anonymous readers can explore every sample page and the architecture without a backend call", async ({ page }) => {
  const backendRequests: string[] = [];
  page.on("request", request => {
    if (request.url().startsWith("http://127.0.0.1:55321/")) backendRequests.push(new URL(request.url()).pathname);
  });
  await page.route("http://127.0.0.1:55321/**", route => route.abort());
  await page.goto("/");
  await page.getByRole("link", { name: "View demo", exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: "Small story. Full picture." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A read-only sample", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "A map in the moonlight", exact: true })).toBeVisible();
  for (let chapter = 2; chapter <= 5; chapter++) {
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByText(`Chapter ${chapter} of 5`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "The way home", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read again", exact: true }).click();
  await expect(page.getByText("Chapter 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Page 3: The patient crossing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The patient crossing", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/demo-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/demo-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Explore the architecture →", exact: true }).click();
  await expect(page).toHaveURL(/\/architecture$/);
  await expect(page.getByRole("heading", { name: "One story. Clear boundaries." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "Serve private illustrations", exact: true })).toBeVisible();
  expect(backendRequests).toEqual([]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});
