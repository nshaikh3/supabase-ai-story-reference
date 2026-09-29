import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, supabase } = await requireUser();
  const params = await searchParams;
  // The count uses the user's JWT and RLS, never a privileged client.
  const { count, error } = await supabase.from("stories").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  return <main className="mx-auto max-w-4xl px-6 py-10 sm:py-16">
    <nav className="mb-12 flex flex-wrap items-center justify-between gap-4" aria-label="Account">
      <Link href="/" className="font-semibold text-primary" prefetch={false}>Supabase AI Story Reference</Link>
      <form action={signOut}><Button type="submit" variant="outline">Sign out</Button></form>
    </nav>
    <h1 className="text-4xl font-semibold tracking-tight">Your account</h1>
    <p className="mt-4 text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user.email}</span></p>
    {params.error === "sign-out" && <p role="alert" className="mt-4 text-destructive">Sign-out could not be completed. Please try again.</p>}
    <div className="mt-10 grid items-start gap-6 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Your story workspace</CardTitle></CardHeader><CardContent className="space-y-4">
        {error ? <p role="alert">We couldn’t load your story count. Please try again later.</p> : <p><strong className="text-3xl text-primary">{count ?? 0}</strong> stories in your account</p>}
        <p className="leading-relaxed text-muted-foreground">Your account is ready. Creating stories and uploading images arrive in the next phase.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Change your password</CardTitle></CardHeader><CardContent><AuthForm mode="password" /></CardContent></Card>
    </div>
  </main>;
}
