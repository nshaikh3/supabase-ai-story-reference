import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function WorkspaceNav() {
  return <nav aria-label="Workspace" className="mb-10 flex flex-wrap items-center justify-between gap-5 border-b pb-6">
    <Link href="/dashboard" className="font-semibold tracking-tight text-primary" prefetch={false}>Supabase AI Story Reference</Link>
    <div className="flex items-center gap-5 text-sm"><Link href="/dashboard" prefetch={false}>My stories</Link><Link href="/account" prefetch={false}>Account</Link><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></div>
  </nav>;
}
