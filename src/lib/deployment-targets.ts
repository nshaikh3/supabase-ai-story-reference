export type ReferenceEnvironment = "local" | "staging" | "production";
export type HostedTarget = Readonly<{
  projectRef: string;
  projectName: string;
  appOrigin: string;
  testMailOrigin: string | null;
}>;
export type TargetManifest = Readonly<{
  schemaVersion: 1;
  staging: HostedTarget | null;
  production: HostedTarget | null;
}>;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).sort().join(",") === expected.sort().join(",");
}

// These are reviewed, canonical hosted origins, never request-derived redirects.
export function isHostedOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value === url.origin &&
      !url.username && !url.password && !url.port && url.hostname.includes(".") &&
      !url.hostname.includes(":") && !url.hostname.endsWith(".") &&
      !/^\d+(?:\.\d+){3}$/.test(url.hostname) &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname);
  } catch { return false; }
}

export function validateTargetManifest(input: unknown): TargetManifest {
  if (!record(input) || !exactKeys(input, ["schemaVersion", "staging", "production"]) || input.schemaVersion !== 1) {
    throw new Error("Invalid reference target manifest.");
  }
  function target(environment: "staging" | "production"): HostedTarget | null {
    const entry = (input as Record<string, unknown>)[environment];
    if (entry === null) return null;
    if (!record(entry) || !exactKeys(entry, ["projectRef", "projectName", "appOrigin", "testMailOrigin"]) ||
      typeof entry.projectRef !== "string" || !/^[a-z]{20}$/.test(entry.projectRef) ||
      entry.projectName !== `supabase-ai-story-reference-${environment}` || !isHostedOrigin(entry.appOrigin) ||
      !(entry.testMailOrigin === null || (environment === "staging" && isHostedOrigin(entry.testMailOrigin))) ||
      entry.testMailOrigin === entry.appOrigin) {
      throw new Error(`Invalid ${environment} reference target.`);
    }
    return Object.freeze({
      projectRef: entry.projectRef, projectName: entry.projectName,
      appOrigin: entry.appOrigin, testMailOrigin: entry.testMailOrigin,
    });
  }
  const staging = target("staging"), production = target("production");
  if (staging && production && (staging.projectRef === production.projectRef || staging.appOrigin === production.appOrigin || staging.testMailOrigin === production.appOrigin)) {
    throw new Error("Staging and production require separate reference projects and origins.");
  }
  return Object.freeze({ schemaVersion: 1, staging, production });
}

export function resolveAppConfiguration(input: {
  environment?: string;
  supabaseUrl?: string;
  publishableKey?: string;
  appOrigin?: string;
}, manifest: unknown) {
  const targets = validateTargetManifest(manifest);
  const environment = input.environment ?? "local";
  if (!["local", "staging", "production"].includes(environment)) throw new Error("Unknown reference environment.");
  let url = "http://127.0.0.1:55321", appUrl = "http://127.0.0.1:3100";
  if (environment !== "local") {
    const target = targets[environment as "staging" | "production"];
    if (!target) throw new Error("Hosted reference target is not configured.");
    url = `https://${target.projectRef}.supabase.co`;
    appUrl = target.appOrigin;
  }
  if (input.supabaseUrl !== url || input.appOrigin !== appUrl) throw new Error("Configuration must match the selected reference target exactly.");
  if (!input.publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(input.publishableKey)) {
    throw new Error("A Supabase publishable key is required; privileged keys are forbidden.");
  }
  return {
    environment: environment as ReferenceEnvironment, url, appUrl, key: input.publishableKey,
    secureCookies: environment !== "local", signupAllowed: environment === "local",
  };
}

export function resolveBuildConfiguration(env: Record<string, string | undefined>, manifest: unknown) {
  if (env.VERCEL === "1" && (!env.NEXT_PUBLIC_REFERENCE_ENV || env.NEXT_PUBLIC_REFERENCE_ENV === "local")) {
    throw new Error("Vercel builds require a configured hosted reference target; local settings cannot be published.");
  }
  return resolveAppConfiguration({
    environment: env.NEXT_PUBLIC_REFERENCE_ENV,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    appOrigin: env.NEXT_PUBLIC_APP_URL,
  }, manifest);
}
