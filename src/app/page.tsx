import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const foundations = [
  ["01", "Relational by design", "Stories own their pages and asset metadata. One ownership boundary, expressed in Postgres."],
  ["02", "Private by default", "Verified sign-in and database ownership policies keep each account’s stories private."],
  ["03", "Reproducible locally", "Versioned migrations, synthetic fixtures, generated types, and database tests travel with the project."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <a className="font-semibold tracking-tight" href="#">Supabase AI Story Reference</a>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">Local reference · Mock AI</span>
      </nav>
      <section className="max-w-3xl py-20 sm:py-28">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">Small stories. Thoughtful architecture.</p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">A story application with security at its foundation.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">A public reference project exploring Supabase, relational data, and asynchronous AI workflows. Built incrementally, with inspectable decisions and tests.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild><Link href="/sign-up" prefetch={false}>Create an account</Link></Button>
          <Button asChild variant="outline"><Link href="/sign-in" prefetch={false}>Sign in</Link></Button>
        </div>
      </section>
      <section id="architecture" aria-label="Architecture foundation" className="grid gap-5 md:grid-cols-3">
        {foundations.map(([number, title, description]) => (
          <Card key={number}>
            <CardHeader><p className="mb-5 font-mono text-sm text-primary">{number}</p><CardTitle className="text-xl">{title}</CardTitle></CardHeader>
            <CardContent><p className="leading-relaxed text-muted-foreground">{description}</p></CardContent>
          </Card>
        ))}
      </section>
      <section id="next" className="my-16 grid gap-5 border-y py-10 sm:grid-cols-2">
        <h2 className="text-2xl font-semibold tracking-tight">From an idea to a five-page adventure.</h2>
        <p className="leading-relaxed text-muted-foreground">Create your account, draft stories, upload private hero illustrations, and generate a five-page story with the free mock provider. Private live updates keep your open story tabs in sync. Use fictional names and synthetic illustrations for this local demo.</p>
      </section>
      <footer className="pb-6 text-sm text-muted-foreground">Next.js · PostgreSQL · Supabase · TypeScript</footer>
    </main>
  );
}
