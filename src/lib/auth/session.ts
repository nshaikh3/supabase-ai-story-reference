import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  // Check with Auth again at the protected data boundary, independently of Proxy.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  return { supabase, user };
}
