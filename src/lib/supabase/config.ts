import targets from "../../../deployment/targets.json";
import { resolveAppConfiguration } from "../deployment-targets";

export function getSupabaseConfig() {
  return resolveAppConfiguration({
    environment: process.env.NEXT_PUBLIC_REFERENCE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    appOrigin: process.env.NEXT_PUBLIC_APP_URL,
  }, targets);
}
