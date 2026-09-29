import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { validAuthCode } from "@/lib/auth/validation";

export async function GET(request: Request) {
  const { appUrl } = getSupabaseConfig();
  const code = new URL(request.url).searchParams.get("code");
  let destination = "/sign-in?error=confirmation";
  if (validAuthCode(code)) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) destination = "/account";
    } catch {
      // Never include raw provider errors, codes, tokens or redirect URLs in output.
    }
  }
  // Neither next nor forwarded host parameters can choose an external destination.
  const response = NextResponse.redirect(new URL(destination, appUrl));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
