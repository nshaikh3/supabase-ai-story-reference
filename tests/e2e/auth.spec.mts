import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../../scripts/local-config.mjs";

const api = "http://127.0.0.1:55321";
const mail = "http://127.0.0.1:55324";
// Refuse linked or differently configured projects before generating synthetic users.
test.beforeAll(() => { loadConfig(); });

async function submitCredentials(page: Page, email: string, password: string, label: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function confirmationLink(request: APIRequestContext, mailbox: string, subject: RegExp) {
  let messageId = "";
  await expect.poll(async () => {
    const response = await request.get(`${mail}/api/v1/search`, { params: { query: `to:"${mailbox}@example.test"` } });
    if (!response.ok()) return false;
    const result = await response.json() as { messages: { ID: string; Subject: string; To: { Address: string }[] }[] };
    const match = result.messages.find(message => subject.test(message.Subject) && message.To.some(recipient => recipient.Address === `${mailbox}@example.test`));
    messageId = match?.ID ?? "";
    return Boolean(messageId);
  }, { timeout: 30_000, message: "Local confirmation email was delivered" }).toBe(true);
  const response = await request.get(`${mail}/api/v1/message/${messageId}`);
  const message = await response.json() as { Text: string };
  const matched = message.Text.match(/https?:\/\/[^\s<>]+\/auth\/v1\/verify\?[^\s<>]+/);
  if (!matched) throw new Error("No verification link in synthetic test email");
  const url = new URL(matched[0].replaceAll("&amp;", "&"));
  if (url.origin !== api || url.pathname !== "/auth/v1/verify") throw new Error("Refusing non-reference confirmation URL");
  return url.toString();
}

test("anonymous and forged sessions cannot open the account page", async ({ page, context }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const forgedId = "11111111-1111-4111-8111-111111111111";
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const encodedClaims = Buffer.from(JSON.stringify({ sub: forgedId, exp: expires, role: "authenticated" })).toString("base64url");
  const forgedSession = { access_token: `${encodedHeader}.${encodedClaims}.invalid-signature`, refresh_token: "invalid-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { id: forgedId } };
  const forgedCookie = `base64-${Buffer.from(JSON.stringify(forgedSession)).toString("base64url")}`;
  await context.addCookies([{ name: "sb-127-auth-token", value: forgedCookie, domain: "127.0.0.1", path: "/" }]);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toHaveCount(0);
});

test("invalid callback links remain on this app and are not cached", async ({ request, page }) => {
  const response = await request.get("/auth/callback?code=invalid&next=https://evil.test", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("http://127.0.0.1:3100/sign-in?error=confirmation");
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/sign-in?error=confirmation");
  await expect(page.locator("main").getByRole("alert")).toContainText("invalid, expired");
});

test("sign-up, confirmation, reload, sign-out, sign-in and password recovery", async ({ page, request, browser }) => {
  const mailbox = `phase2-${randomUUID()}`;
  const email = `${mailbox}@example.test`;
  const password = `${randomUUID()}-Initial!`;
  const replacement = `${randomUUID()}-Replacement!`;
  await page.goto("/sign-up");
  await submitCredentials(page, email, password, "Create account");
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await submitCredentials(page, email, password, "Sign in");
  await expect(page.locator("main").getByRole("alert")).toContainText("Unable to sign in");
  const link = await confirmationLink(request, mailbox, /confirm|sign.?up/i);
  await page.goto(link);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText("0", { exact: true })).toBeVisible();
  // Force the SDK's refresh path without changing the signed JWT or valid refresh token.
  const originalCookies = await page.context().cookies();
  const sessionCookies = originalCookies.filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name));
  const encoded = sessionCookies.map(cookie => cookie.value).join("");
  if (!encoded.startsWith("base64-")) throw new Error("Unexpected local SSR session encoding");
  const session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString());
  session.expires_at = 1;
  const forced = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await page.context().clearCookies({ name: /^sb-.*-auth-token(?:\.\d+)?$/ });
  await page.context().addCookies([{ ...sessionCookies[0], name: sessionCookies[0].name.replace(/\.\d+$/, ""), value: forced }]);
  const refreshed = await page.reload();
  const afterRefresh = (await page.context().cookies()).filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).map(cookie => cookie.value).join("");
  expect(afterRefresh !== forced, "Refreshed session cookie was persisted").toBe(true);
  expect(refreshed?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto("http://127.0.0.1:3100/account");
  await expect(anonymousPage).toHaveURL(/\/sign-in$/);
  await anonymous.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("signed out");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await submitCredentials(page, email, "not-the-password", "Sign in");
  await expect(page.locator("main").getByRole("alert")).toContainText("Unable to sign in");
  await submitCredentials(page, email, password, "Sign in");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  const resetLink = await confirmationLink(request, mailbox, /reset|recover/i);
  await page.goto(resetLink);
  await expect(page).toHaveURL(/\/account$/);
  await page.getByLabel("New password").fill(replacement);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toContainText("password has been updated");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await submitCredentials(page, email, password, "Sign in");
  await expect(page.locator("main").getByRole("alert")).toContainText("Unable to sign in");
  await submitCredentials(page, email, replacement, "Sign in");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});
