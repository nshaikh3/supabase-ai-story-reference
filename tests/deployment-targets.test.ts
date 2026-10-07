import { describe, expect, it } from "vitest";
import { isHostedOrigin, resolveAppConfiguration, validateTargetManifest } from "../src/lib/deployment-targets";

const empty = { schemaVersion: 1, staging: null, production: null };
const local = { supabaseUrl: "http://127.0.0.1:55321", appOrigin: "http://127.0.0.1:3100", publishableKey: "sb_publishable_synthetic_fixture" };
const staging = { projectRef: "aaaaaaaaaaaaaaaaaaaa", projectName: "supabase-ai-story-reference-staging", appOrigin: "https://staging.example.com", testMailOrigin: "https://mail.example.com" };
const production = { projectRef: "bbbbbbbbbbbbbbbbbbbb", projectName: "supabase-ai-story-reference-production", appOrigin: "https://stories.example.com", testMailOrigin: null };

describe("reviewed reference targets", () => {
  it("retains the exact local default without enabling hosted targets", () => {
    expect(resolveAppConfiguration(local, empty)).toMatchObject({ environment: "local", secureCookies: false, signupAllowed: true });
    for (const environment of ["staging", "production"]) expect(() => resolveAppConfiguration({ ...local, environment }, empty)).toThrow("not configured");
  });
  it.each(["", "preview", "LOCAL", "https://other.example.com"])("rejects unknown mode %s", environment => {
    expect(() => resolveAppConfiguration({ ...local, environment }, empty)).toThrow("Unknown");
  });
  it.each(["http://localhost:55321", "http://127.0.0.1:54321", "http://127.0.0.1:55321/", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co"])("rejects local API substitution %s", supabaseUrl => {
    expect(() => resolveAppConfiguration({ ...local, supabaseUrl }, empty)).toThrow("exactly");
  });
  it.each(["sb_secret_synthetic_fixture", "legacy.jwt.fixture", "sb_publishable_", "sb_publishable_bad\n", "sb_publishable_bad\0", "sb_publishable_bad:key"])("rejects invalid key form %s", publishableKey => {
    expect(() => resolveAppConfiguration({ ...local, publishableKey }, empty)).toThrow("publishable");
  });
  it.each([
    "http://staging.example.com", "https://user:password@staging.example.com", "https://staging.example.com/path",
    "https://staging.example.com?next=evil", "https://staging.example.com#evil", "https://staging.example.com:443",
    "https://staging.example.com:8443", "https://staging.example.com/", "https://127.0.0.1", "https://[::1]",
    "https://localhost", "https://dev.localhost", "https://service.internal", "https://staging.example.com.",
  ])("rejects unsafe/noncanonical hosted origin %s", value => expect(isHostedOrigin(value)).toBe(false));
  it("accepts only the declared hosted project and origin, with secure cookies and invite-only app signup", () => {
    const config = { environment: "staging", supabaseUrl: `https://${staging.projectRef}.supabase.co`, appOrigin: staging.appOrigin, publishableKey: local.publishableKey };
    expect(resolveAppConfiguration(config, { ...empty, staging, production })).toMatchObject({ secureCookies: true, signupAllowed: false });
    for (const change of [{ supabaseUrl: `https://${production.projectRef}.supabase.co` }, { appOrigin: production.appOrigin }, { environment: "production" }]) {
      expect(() => resolveAppConfiguration({ ...config, ...change }, { ...empty, staging, production })).toThrow("exactly");
    }
  });
  it("rejects accidental staging/production sharing", () => {
    expect(() => validateTargetManifest({ ...empty, staging, production: { ...production, projectRef: staging.projectRef } })).toThrow("separate");
    expect(() => validateTargetManifest({ ...empty, staging, production: { ...production, appOrigin: staging.appOrigin } })).toThrow("separate");
  });
  it("rejects incomplete or unrelated project declarations", () => {
    for (const change of [{ projectRef: "wrong/path" }, { projectName: "commercial-app" }, { appOrigin: "https://evil.example.com/?token=secret" }, { testMailOrigin: "http://mail.example.com" }]) {
      expect(() => validateTargetManifest({ ...empty, staging: { ...staging, ...change } })).toThrow("Invalid staging");
    }
    expect(() => validateTargetManifest({ ...empty, production: { ...production, testMailOrigin: staging.testMailOrigin } })).toThrow("Invalid production");
    expect(() => validateTargetManifest({ ...empty, staging: { ...staging, testMailOrigin: staging.appOrigin } })).toThrow("Invalid staging");
  });
  it("rejects extra fields rather than accepting credential-bearing manifests", () => {
    for (const manifest of [{ ...empty, secret: "synthetic" }, { ...empty, staging: { ...staging, secret: "synthetic" } }, { ...empty, schemaVersion: 2 }, []]) {
      expect(() => validateTargetManifest(manifest)).toThrow("Invalid");
    }
  });
});
