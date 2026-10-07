import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../../../types/database";
import { getSupabaseConfig } from "./config";

export async function createClient(options?: { timeoutMs: number }) {
  const { url, key, secureCookies } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    ...(options ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(options.timeoutMs)]) : AbortSignal.timeout(options.timeoutMs) }) } } : {}),
    cookieOptions: { sameSite: "lax", path: "/", secure: secureCookies },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy refreshes them first;
          // Server Actions and the callback route can persist cookie changes.
        }
      },
    },
  });
}
