import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function ForgotPassword() {
  return <AuthShell title="Reset your password" description="We’ll send a link to help you get back into your account.">
    <AuthForm mode="reset" />
    <Link className="text-sm text-primary underline" href="/sign-in" prefetch={false}>Back to sign in</Link>
  </AuthShell>;
}
