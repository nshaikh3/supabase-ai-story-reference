"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-6 px-6 py-20">
    <h1 className="text-3xl font-semibold">We couldn’t load this page</h1>
    <p className="text-muted-foreground">Please try again in a moment.</p>
    <Button onClick={reset}>Try again</Button>
    <Link className="ml-4 text-primary underline" href="/" prefetch={false}>Back home</Link>
  </main>;
}
