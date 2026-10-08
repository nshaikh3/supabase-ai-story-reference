import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceNav } from "@/components/reference-nav";
import { repositoryUrl } from "@/lib/reference";

const foundations = [
  ["01", "Relational by design", "Stories own their pages and asset metadata. One ownership boundary, expressed in Postgres."],
  ["02", "Private by default", "Verified sign-in and database ownership policies keep each account’s stories private."],
  ["03", "Reproducible locally", "Versioned migrations, synthetic fixtures, generated types, and database tests travel with the project."],
];

export function ReferenceHome({ privateApp = true }: { privateApp?: boolean }) {
  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-10">
      <ReferenceNav privateApp={privateApp} />
      <section className="max-w-3xl py-20 sm:py-28">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">Small stories. Thoughtful architecture.</p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">A story application with security at its foundation.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">Explore a five-page adventure, then follow the Supabase architecture behind private stories, authenticated generation and live updates. Built incrementally, with inspectable decisions and tests.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild><Link href="/demo" prefetch={false}>View demo</Link></Button>
          {repositoryUrl && <Button asChild variant="outline"><a href={repositoryUrl}>View source on GitHub</a></Button>}
          <Button asChild variant="outline"><Link href="/architecture" prefetch={false}>View architecture</Link></Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">No account needed for the read-only sample. Fictional content; mock AI by default.</p>
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
        <div><p className="leading-relaxed text-muted-foreground">The private application lets you draft stories, upload private hero illustrations and generate five pages with the free mock provider. Private live updates keep open story tabs in sync. Use fictional names and synthetic illustrations.</p>{privateApp ? <Link className="mt-5 inline-block font-semibold text-primary underline underline-offset-4" href="/sign-in" prefetch={false}>Sign in to the working application →</Link> : <p className="mt-5 text-sm font-medium text-primary">The full application runs locally. This public site contains the read-only sample and architecture tour.</p>}</div>
      </section>
      <footer className="pb-6 text-sm text-muted-foreground">Next.js · PostgreSQL · Supabase · TypeScript</footer>
    </main>
  );
}
