import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "http://127.0.0.1:55321", key: "sb_publishable_test", appUrl: "http://127.0.0.1:3100" }) }));
import { updateSession } from "@/lib/supabase/proxy";
beforeEach(() => { vi.resetAllMocks(); mocks.createServerClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } }); });
describe("session refresh and route protection", () => {
  it.each(["/account", "/dashboard", "/stories/new", "/stories/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"])("protects %s without trusting next or forwarded host", async path => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await updateSession(new NextRequest(`http://127.0.0.1:3100${path}?next=https://evil.test`, { headers: { "x-forwarded-host": "evil.test" } }));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3100/sign-in");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects an invalid JWT even if a user object is supplied", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "forged" } }, error: new Error("invalid signature") });
    const response = await updateSession(new NextRequest("http://127.0.0.1:3100/account"));
    expect(response.status).toBe(307);
  });
  it("passes verified requests and never caches private responses", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "verified" } }, error: null });
    const response = await updateSession(new NextRequest("http://127.0.0.1:3100/account"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("forwards refreshed cookies to downstream rendering and the browser", async () => {
    const request = new NextRequest("http://127.0.0.1:3100/account");
    mocks.getClaims.mockImplementation(async () => {
      const options = mocks.createServerClient.mock.calls[0][2];
      options.cookies.setAll([{ name: "sb-test-auth-token", value: "refreshed", options: { path: "/", sameSite: "lax" } }], { "Cache-Control": "private, no-store", "Expires": "0" });
      return { data: { claims: { sub: "verified" } }, error: null };
    });
    const response = await updateSession(request);
    expect(request.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("expires")).toBe("0");
  });
  it("retains cookie removal and cache protection on a redirect", async () => {
    mocks.getClaims.mockImplementation(async () => {
      mocks.createServerClient.mock.calls[0][2].cookies.setAll([{ name: "sb-test-auth-token", value: "", options: { maxAge: 0 } }], {});
      return { data: null, error: null };
    });
    const response = await updateSession(new NextRequest("http://127.0.0.1:3100/account"));
    expect(response.cookies.get("sb-test-auth-token")?.maxAge).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps sign-in accessible without a session", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await updateSession(new NextRequest("http://127.0.0.1:3100/sign-in"));
    expect(response.headers.get("location")).toBeNull();
  });
});
