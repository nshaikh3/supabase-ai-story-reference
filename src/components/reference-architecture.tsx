import type { Metadata } from "next";
import Link from "next/link";
import { ReferenceNav } from "@/components/reference-nav";
import { Button } from "@/components/ui/button";
import { architectureSteps, repositoryUrl } from "@/lib/reference";

export const metadata: Metadata = { title: "Architecture | Supabase AI Story Reference", description: "A technical tour of owner-isolated stories, private images, authenticated generation and private Realtime updates." };

const tradeoffs = [
  ["The database decides ownership", "One immutable story owner is the source of truth. Child access follows the parent. Grants and row-level policies protect direct API requests, independently of the interface."],
  ["Notifications point to saved state", "Broadcast carries a small status hint, not story text. Clients refetch through their own permissions. Reconnects recover from the database because notifications are not a durable event queue."],
  ["Generation has explicit limits", "A caller JWT and worker capability are both required. Leases, attempt limits and atomic completion bound the workflow. Interrupted requests need manual recovery; there is no durable background worker."],
  ["Privacy crosses service boundaries", "Private Storage and image metadata cannot share a transaction. Reserved paths, permanent retirement and reviewed cleanup manage failures without treating database metadata deletion as byte deletion."],
];

export function ReferenceArchitecture({ privateApp = true }: { privateApp?: boolean }) {
  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-10">
      <ReferenceNav privateApp={privateApp} />
      <header className="max-w-3xl py-14 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">A five-minute technical tour</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">One story. Clear boundaries.</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">A small reference application makes the decisions visible: who owns the data, who can run work, what happens when a request fails, and how we verify it.</p>
      </header>
      <section aria-labelledby="workflow-title">
        <h2 id="workflow-title" className="text-2xl font-semibold">From a private draft to a finished story</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {architectureSteps.map(step => <li key={step.number} className="rounded-2xl border bg-card p-6"><p className="font-mono text-sm text-primary">{step.number} / {step.service}</p><h3 className="mt-5 text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{step.description}</p></li>)}
        </ol>
      </section>
      <section className="my-16" aria-labelledby="decisions-title">
        <h2 id="decisions-title" className="text-2xl font-semibold">Decisions worth discussing</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2">{tradeoffs.map(([title, description]) => <article key={title} className="border-t pt-6"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{description}</p></article>)}</div>
      </section>
      <section className="mb-14 rounded-2xl border bg-secondary p-7 sm:p-10" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="text-2xl font-semibold">Inspectable evidence</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">The repository contains versioned migrations, actual-role SQL tests, browser workflows, query-plan measurements and an AI-development record. Passing local checks is evidence of those tested behaviors, not a claim of production capacity or an independent security audit.</p>
        {repositoryUrl ? <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 font-semibold text-primary"><li><a className="underline underline-offset-4" href={`${repositoryUrl}/blob/main/docs/REVIEWER-GUIDE.md`}>Reviewer guide</a></li><li><a className="underline underline-offset-4" href={`${repositoryUrl}/blob/main/docs/SECURITY.md`}>Security model</a></li><li><a className="underline underline-offset-4" href={`${repositoryUrl}/blob/main/docs/DECISIONS.md`}>Decision record</a></li><li><a className="underline underline-offset-4" href={`${repositoryUrl}/blob/main/docs/AI-DEVELOPMENT.md`}>AI-assisted development</a></li></ul> : <p className="mt-5 text-sm text-muted-foreground">Public source publication is in progress. These records are available in the local repository’s docs folder.</p>}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t py-8"><p className="text-sm text-muted-foreground">Next.js · PostgreSQL · Supabase · TypeScript</p><Button asChild variant="outline"><Link href="/demo" prefetch={false}>Read the sample story</Link></Button></footer>
    </main>
  );
}
