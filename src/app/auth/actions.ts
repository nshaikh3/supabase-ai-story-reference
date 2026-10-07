"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth/session";
import { readEmail, readPassword, type AuthState } from "@/lib/auth/validation";

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = readEmail(form);
  const password = readPassword(form, 1);
  if (!email || !password) return { error: "Enter a valid email and password." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Unable to sign in. Check your details and confirm your email, or try again later." };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signUp(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = readEmail(form);
  const password = readPassword(form);
  if (!email || !password) return { error: "Enter a valid email and a password with 10–128 characters." };
  try {
    if (!getSupabaseConfig().signupAllowed) return { error: "This reference workspace is invitation-only. Contact the project maintainer for access." };
    const supabase = await createClient();
    const { appUrl } = getSupabaseConfig();
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${appUrl}/auth/callback` } });
    if (error) return { error: "Unable to create an account. Please try again later or sign in if you already registered." };
    return { message: "Check your email for a confirmation link. Open it in this browser to finish signing up." };
  } catch {
    return { error: "Sign-up is temporarily unavailable. Please try again." };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/account?error=sign-out");
  revalidatePath("/", "layout");
  redirect("/sign-in?message=signed-out");
}

export async function requestPasswordReset(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = readEmail(form);
  if (!email) return { error: "Enter a valid email address." };
  try {
    const supabase = await createClient();
    const { appUrl } = getSupabaseConfig();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/auth/callback` });
    if (error) return { error: "Unable to send a reset link right now. Please try again later." };
    return { message: "If an account exists for this email, a reset link is on its way. Open it in this browser, then set a new password on your account page." };
  } catch {
    return { error: "Password reset is temporarily unavailable. Please try again." };
  }
}

export async function updatePassword(_previous: AuthState, form: FormData): Promise<AuthState> {
  const password = readPassword(form);
  if (!password) return { error: "Use a password with 10–128 characters." };
  const { supabase } = await requireUser();
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "Unable to change your password. Use a different password or request a fresh reset link." };
    return { message: "Your password has been updated." };
  } catch {
    return { error: "Password update is temporarily unavailable. Please try again." };
  }
}
