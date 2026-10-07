"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../../../types/database";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { url, key, secureCookies } = getSupabaseConfig();
  return createBrowserClient<Database>(url, key, {
    cookieOptions: { sameSite: "lax", path: "/", secure: secureCookies },
  });
}
