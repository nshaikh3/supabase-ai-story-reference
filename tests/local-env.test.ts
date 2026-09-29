import { describe, expect, it } from "vitest";
import { publicEnvironmentFromStatus } from "../scripts/local-env.mjs";
import { loadConfig, validateConfig } from "../scripts/local-config.mjs";
const status = { API_URL: "http://127.0.0.1:55321", PUBLISHABLE_KEY: "sb_publishable_test", SECRET_KEY: "never-copy-secret", SERVICE_ROLE_KEY: "never-copy-admin", JWT_SECRET: "never-copy-signing-key" };
describe("safe local Auth configuration", () => {
  it("writes only public reference configuration", () => {
    const output = publicEnvironmentFromStatus(status);
    expect(output).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test");
    expect(output).not.toContain("never-copy");
    expect(output).not.toContain("SECRET");
  });
  it("rejects other stacks and injected env lines", () => {
    expect(() => publicEnvironmentFromStatus({ ...status, API_URL: "http://127.0.0.1:54321" })).toThrow();
    expect(() => publicEnvironmentFromStatus({ ...status, PUBLISHABLE_KEY: "sb_publishable_test\nMALICIOUS=true" })).toThrow();
    expect(() => publicEnvironmentFromStatus({ ...status, PUBLISHABLE_KEY: "sb_secret_private" })).toThrow();
  });
  it("rejects weaker Auth configuration", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, auth: { ...config.auth, email: { enable_confirmations: false } } })).toThrow();
    expect(() => validateConfig({ ...config, auth: { ...config.auth, enable_anonymous_sign_ins: true } })).toThrow();
    expect(() => validateConfig({ ...config, auth: { ...config.auth, additional_redirect_urls: ["https://evil.test"] } })).toThrow();
  });
});
