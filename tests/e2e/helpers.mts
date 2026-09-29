import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
const api = "http://127.0.0.1:55321";
const mail = "http://127.0.0.1:55324";
export async function submitCredentials(page: Page, email: string, password: string, label: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: label, exact: true }).click();
}

export async function confirmationLink(request: APIRequestContext, mailbox: string, subject: RegExp) {
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

export async function createSyntheticAccount(page: Page, request: APIRequestContext) {
  const mailbox = `phase3-${randomUUID()}`;
  await page.goto("/sign-up");
  await submitCredentials(page, `${mailbox}@example.test`, `${randomUUID()}-Synthetic!`, "Create account");
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await confirmationLink(request, mailbox, /confirm|sign.?up/i));
  await expect(page).toHaveURL(/\/account$/);
  const cookies = (await page.context().cookies()).filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name));
  const encoded = cookies.map(cookie => cookie.value).join("");
  if (!encoded.startsWith("base64-")) throw new Error("Unexpected local SSR session encoding");
  return JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString()) as { access_token: string; user: { id: string } };
}
