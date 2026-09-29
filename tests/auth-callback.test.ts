import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ appUrl: "http://127.0.0.1:3100" }) }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => vi.resetAllMocks());
describe("PKCE confirmation callback", () => {
  it("exchanges a code and only redirects to the fixed account route", async () => {
    mocks.exchange.mockResolvedValue({ error: null });
    const response = await GET(new Request("http://evil.test/auth/callback?code=11111111-1111-4111-8111-111111111111&next=https://evil.test"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3100/account");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it.each(["", "?code=short", "?error=access_denied&error_description=private-text"])("rejects missing or unusable codes safely", async query => {
    const response = await GET(new Request(`http://127.0.0.1:3100/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3100/sign-in?error=confirmation");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("handles expired or reused codes without exposing raw errors", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "private-error" } });
    const response = await GET(new Request("http://127.0.0.1:3100/auth/callback?code=11111111-1111-4111-8111-111111111111"));
    expect(response.headers.get("location")).toMatch("error=confirmation");
  });
});
