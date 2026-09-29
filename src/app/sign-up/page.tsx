import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function SignUp() {
  return <AuthShell title="Make room for a story" description="Create an account, then confirm your email to get started.">
    <AuthForm mode="sign-up" />
    <p className="text-sm text-muted-foreground">Already registered? <Link className="text-primary underline" href="/sign-in" prefetch={false}>Sign in</Link></p>
  </AuthShell>;
}
