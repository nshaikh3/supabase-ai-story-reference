import type { Metadata } from "next";
import Link from "next/link";
import { ReferenceNav } from "@/components/reference-nav";
import { StorySample } from "@/components/story-sample";
import { Button } from "@/components/ui/button";
import { architectureSteps, repositoryUrl } from "@/lib/reference";

export const metadata: Metadata = {
  title: "Story demo | Supabase AI Story Reference",
  description: "Read a fictional five-page story without an account, then explore the Supabase architecture behind the working application.",
};

export function ReferenceDemo({ privateApp = true }: { privateApp?: boolean }) {
  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-10">
      <ReferenceNav privateApp={privateApp} />
      <header className="max-w-3xl pb-10 pt-14 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Explore without an account</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Small story. Full picture.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">Read a sample adventure, then explore how the working application keeps stories private and open tabs in sync.</p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <StorySample />
        <aside className="space-y-6" aria-label="About this demonstration">
          <section className="rounded-2xl border bg-secondary p-6">
            <h2 className="text-lg font-semibold">A read-only sample</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">This fictional story is bundled with the website. Reading it creates no account, saves no story and makes no AI-provider call.</p>
            <p className="mt-3 leading-relaxed text-muted-foreground">The private application runs the actual Auth, database, Storage, Edge and Realtime workflow. This page does not simulate a live generation job.</p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Inside the working application</h2>
            <ol className="mt-5 space-y-5">
              {architectureSteps.slice(0, 4).map(step => <li key={step.number} className="flex gap-3"><span className="pt-0.5 font-mono text-xs text-primary">{step.number}</span><div><p className="font-medium">{step.title}</p><p className="mt-1 text-sm text-muted-foreground">{step.service}</p></div></li>)}
            </ol>
            <Link href="/architecture" prefetch={false} className="mt-6 inline-block font-semibold text-primary underline underline-offset-4">Explore the architecture →</Link>
          </section>
          <p className="px-1 text-sm leading-relaxed text-muted-foreground">Built with AI assistance. Design choices, tests and known limitations are documented for review.</p>
        </aside>
      </div>
      <section className="my-14 flex flex-wrap items-center justify-between gap-6 border-y py-8">
        <div><h2 className="text-xl font-semibold">Follow the evidence</h2><p className="mt-2 text-muted-foreground">See the ownership model, failure handling and verification record.</p></div>
        <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/architecture" prefetch={false}>View architecture</Link></Button>{repositoryUrl && <Button asChild><a href={repositoryUrl}>View source on GitHub</a></Button>}</div>
      </section>
      <footer className="pb-8 text-sm text-muted-foreground">Synthetic content only · No real child information · Mock AI by default</footer>
    </main>
  );
}
