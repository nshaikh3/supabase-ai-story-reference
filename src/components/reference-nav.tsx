import Link from "next/link";
import { repositoryUrl } from "@/lib/reference";

export function ReferenceNav({ privateApp = true }: { privateApp?: boolean }) {
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-5 border-b py-6">
      <Link href="/" prefetch={false} className="font-semibold tracking-tight">Supabase AI Story Reference</Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <Link href="/demo" prefetch={false} className="hover:underline">Demo</Link>
        <Link href="/architecture" prefetch={false} className="hover:underline">Architecture</Link>
        {repositoryUrl && <a href={repositoryUrl} className="hover:underline">GitHub</a>}
        {privateApp ? <Link href="/sign-in" prefetch={false} className="font-semibold text-primary hover:underline">Sign in</Link> : <span className="text-muted-foreground">Read-only demo</span>}
      </div>
    </nav>
  );
}
