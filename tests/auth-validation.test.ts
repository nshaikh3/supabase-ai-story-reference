import { describe, expect, it, vi, afterEach } from "vitest";
import { readEmail, readPassword, validAuthCode } from "@/lib/auth/validation";
import { getSupabaseConfig } from "@/lib/supabase/config";

function form(email: string, password = "long-enough-password") {
  const value = new FormData(); value.set("email", email); value.set("password", password); return value;
}
afterEach(() => vi.unstubAllEnvs());
describe("Auth input boundaries", () => {
  it("normalizes email whitespace without altering passwords", () => {
    expect(readEmail(form("  alice@example.test  "))).toBe("alice@example.test");
    expect(readPassword(form("a@b.test", "  a long password  "))).toBe("  a long password  ");
  });
  it.each(["", "invalid", "a b@example.test", "a@b", `${"x".repeat(255)}@example.test`])("rejects invalid email %s", email => expect(readEmail(form(email))).toBeNull());
  it("rejects absent fields and files", () => {
    const value = new FormData(); expect(readEmail(value)).toBeNull(); expect(readPassword(value)).toBeNull();
    value.set("email", new Blob(["a@b.test"])); expect(readEmail(value)).toBeNull();
  });
  it("bounds passwords on the server", () => {
    expect(readPassword(form("a@b.test", "123456789"))).toBeNull();
    expect(readPassword(form("a@b.test", "x".repeat(129)))).toBeNull();
    expect(readPassword(form("a@b.test", "x".repeat(128)))).toHaveLength(128);
    expect(readPassword(form("a@b.test", "old"), 1)).toBe("old");
  });
  it.each([null, "", "short", "https://evil.test", "x".repeat(2049), "<script>alert(1)</script>"])("rejects unusable callback codes", code => expect(validAuthCode(code)).toBe(false));
  it("accepts a bounded opaque authorization code", () => expect(validAuthCode("11111111-1111-4111-8111-111111111111")).toBe(true));
});
describe("reference Auth configuration", () => {
  function setup() {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3100");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_local-test");
  }
  it("accepts only this local reference stack", () => { setup(); expect(getSupabaseConfig().url).toBe("http://127.0.0.1:55321"); });
  it.each(["https://commercial.supabase.co", "http://127.0.0.1:54321"])("rejects a different project URL", url => { setup(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url); expect(getSupabaseConfig).toThrow(); });
  it("rejects a forwarded or external app origin", () => { setup(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://evil.test"); expect(getSupabaseConfig).toThrow(); });
  it.each(["", "sb_secret_never-public", "legacy-jwt", "sb_publishable_bad\nkey"])("rejects an invalid public key", key => { setup(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key); expect(getSupabaseConfig).toThrow(); });
});
