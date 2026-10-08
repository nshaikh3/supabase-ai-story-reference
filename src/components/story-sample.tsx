"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { demoStory } from "@/lib/reference";

export function StorySample() {
  const [current, setCurrent] = useState(0);
  const chapter = demoStory.pages[current];

  return (
    <section aria-label="Read the sample story" className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="relative overflow-hidden bg-[#173e31] px-7 py-10 text-[#f9f2da] sm:px-12">
        <svg aria-hidden="true" viewBox="0 0 220 220" className="pointer-events-none absolute -right-8 -top-10 w-64 opacity-20 sm:right-0" fill="none">
          <circle cx="110" cy="110" r="82" stroke="currentColor" />
          <circle cx="110" cy="110" r="60" stroke="currentColor" />
          <path d="M110 12v34m0 128v34M12 110h34m128 0h34M57 57l24 24m58 58 24 24M57 163l24-24m58-58 24-24M110 49l16 45 45 16-45 16-16 45-16-45-45-16 45-16Z" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-[#c9decf]">A little adventure in five pages</p>
        <h2 className="relative mt-4 max-w-md font-serif text-3xl leading-tight sm:text-4xl">{demoStory.title}</h2>
        <p className="relative mt-5 text-sm text-[#c9decf]">Fictional sample · Deterministic mock story</p>
      </div>
      <div className="px-6 py-7 sm:px-12 sm:py-10">
        <nav aria-label="Story pages" className="mb-9 flex flex-wrap gap-2">
          {demoStory.pages.map((page, index) => (
            <button key={page.title} type="button" aria-label={`Page ${index + 1}: ${page.title}`} aria-pressed={current === index} onClick={() => setCurrent(index)} className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${current === index ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>{index + 1}</button>
          ))}
        </nav>
        <div aria-live="polite" aria-atomic="true" className="min-h-72 sm:min-h-64">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Chapter {current + 1} of 5</p>
          <h3 className="mt-3 font-serif text-2xl sm:text-3xl">{chapter.title}</h3>
          <p className="mt-6 max-w-xl font-serif text-lg leading-[1.9] text-[#36463c] sm:text-xl">{chapter.text}</p>
        </div>
        <div className="mt-9 flex items-center justify-between gap-3 border-t pt-6">
          <Button variant="outline" disabled={current === 0} onClick={() => setCurrent(value => value - 1)}>Previous page</Button>
          {current < demoStory.pages.length - 1 ? <Button onClick={() => setCurrent(value => value + 1)}>Next page</Button> : <Button onClick={() => setCurrent(0)}>Read again</Button>}
        </div>
      </div>
    </section>
  );
}
