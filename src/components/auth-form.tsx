"use client";

import { useActionState } from "react";
import { signIn, signUp, requestPasswordReset, updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/lib/auth/validation";

const modes = {
  "sign-in": { action: signIn, label: "Sign in" },
  "sign-up": { action: signUp, label: "Create account" },
  "reset": { action: requestPasswordReset, label: "Send reset link" },
  "password": { action: updatePassword, label: "Update password" },
};

export function AuthForm({ mode }: { mode: keyof typeof modes }) {
  const { action, label } = modes[mode];
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-5">
      {mode !== "password" && <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      </div>}
      {mode !== "reset" && <div className="space-y-2">
        <Label htmlFor="password">{mode === "password" ? "New password" : "Password"}</Label>
        <Input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "sign-in" ? 1 : 10} maxLength={128} aria-describedby={mode === "sign-in" ? undefined : "password-hint"} required />
        {mode !== "sign-in" && <p id="password-hint" className="text-sm text-muted-foreground">Use 10–128 characters.</p>}
      </div>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-secondary p-3 text-sm leading-relaxed">{state.message}</p>}
      <Button className="w-full" type="submit" disabled={pending}>{pending ? "Please wait…" : label}</Button>
    </form>
  );
}
