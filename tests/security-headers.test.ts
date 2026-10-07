import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/security-headers";
const mocks = vi.hoisted(() => ({ config: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: mocks.update }));
import { proxy } from "@/proxy";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ url: "http://127.0.0.1:55321", secureCookies: false });
  mocks.update.mockImplementation((request: NextRequest) => NextResponse.next({ request }));
});
describe("document security headers", () => {
  it("uses a fresh nonce and overwrites attacker-supplied request policy", async () => {
    const request = new NextRequest("http://127.0.0.1:3100/", { headers: { "x-nonce": "attacker", "Content-Security-Policy": "script-src *" } });
    const first = await proxy(request), second = await proxy(new NextRequest(request.url));
    expect(first.headers.get("content-security-policy")).not.toBe(second.headers.get("content-security-policy"));
    expect(first.headers.get("content-security-policy")).toContain(`'nonce-${request.headers.get("x-nonce")}'`);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(first.headers.get("content-security-policy"));
    expect(request.headers.get("x-nonce")).not.toBe("attacker");
    expect(first.headers.get("strict-transport-security")).toBeNull();
    expect(first.headers.get("x-frame-options")).toBe("DENY");
  });
  it("keeps image responses sandboxed", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3100/assets/fixture"));
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
  });
  it("requires HTTPS only for validated hosted configuration", async () => {
    mocks.config.mockReturnValue({ url: "https://abcdefghijklmnopqrst.supabase.co", secureCookies: true });
    const response = await proxy(new NextRequest("https://stories.example.com/"));
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(response.headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
  });
  it("limits connections to the chosen Supabase endpoint and omits eval in production", () => {
    const csp = contentSecurityPolicy("random", "https://abcdefghijklmnopqrst.supabase.co", false, true);
    expect(csp).toContain("connect-src 'self' https://abcdefghijklmnopqrst.supabase.co wss://abcdefghijklmnopqrst.supabase.co");
    expect(csp).not.toContain("unsafe-");
    expect(contentSecurityPolicy("random", "http://127.0.0.1:55321", true, false)).toContain("'unsafe-eval'");
  });
});
