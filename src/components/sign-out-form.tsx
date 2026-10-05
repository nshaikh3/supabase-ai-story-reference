"use client";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function SignOutForm() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return <form action={signOut} onSubmit={async event => {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    try {
      // Browser Auth broadcasts SIGNED_OUT to other tabs so their private
      // subscriptions and visible story data are removed immediately.
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw new Error("Sign-out unavailable");
      window.location.replace("/sign-in?message=signed-out");
    } catch { setFailed(true); setPending(false); }
  }}>
    <Button variant="outline" type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</Button>
    {failed && <p role="alert" className="mt-2 text-sm text-destructive">Sign-out could not be completed. Please try again.</p>}
  </form>;
}
