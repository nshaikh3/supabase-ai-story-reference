import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

export async function proxy(request: NextRequest) {
  const configuration = getSupabaseConfig();
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64");
  const csp = contentSecurityPolicy(nonce, configuration.url, process.env.NODE_ENV === "development", configuration.secureCookies);
  // Replace caller-supplied values before Next reads them for SSR script nonces.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", request.nextUrl.pathname.startsWith("/assets/") ? "default-src 'none'; sandbox" : csp);
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  if (configuration.secureCookies) response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
