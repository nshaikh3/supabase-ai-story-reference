export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  // Hosted configuration is deliberately deferred to deployment preparation.
  if (url !== "http://127.0.0.1:55321" || appUrl !== "http://127.0.0.1:3100") {
    throw new Error("Configure this reference project's local URLs with npm run local:env.");
  }
  if (!key?.startsWith("sb_publishable_") || /\s/.test(key)) {
    throw new Error("A local Supabase publishable key is required. Run npm run local:env.");
  }
  return { url, key, appUrl };
}
