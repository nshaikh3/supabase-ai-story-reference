import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Welcome back" description="Sign in to your private story workspace.">
    {params.error === "confirmation" && <p role="alert" className="text-sm text-destructive">This link is invalid, expired, or was opened in a different browser. Try signing in if your email is confirmed, or request a new password reset link.</p>}
    {params.message === "signed-out" && <p role="status" className="text-sm text-primary">You have been signed out.</p>}
    <AuthForm mode="sign-in" />
    <div className="flex flex-wrap justify-between gap-3 text-sm"><Link className="text-primary underline" href="/sign-up" prefetch={false}>Create an account</Link><Link className="text-primary underline" href="/forgot-password" prefetch={false}>Forgot password?</Link></div>
  </AuthShell>;
}
