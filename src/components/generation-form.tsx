"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { generateStory } from "@/app/stories/generation-actions";
import { Button } from "@/components/ui/button";
import type { StoryState } from "@/lib/stories/validation";

export function GenerationForm({ id, status, attempts }: { id: string; status: string; attempts: number }) {
  const [state, action, pending] = useActionState<StoryState, FormData>(generateStory.bind(null, id), {});
  const router = useRouter();
  return <div className="space-y-4">
    <p className="text-sm leading-relaxed text-muted-foreground">Generate five pages from your saved story details. The default demo uses a deterministic mock. If the maintainer enables Gemini, your title, fictional hero name, and story idea are sent to Google. Images are never sent.</p>
    {status !== "complete" && <form action={action} className="space-y-3">
      <Button disabled={pending || (status === "failed" && attempts >= 3)} type="submit">{pending ? "Generating your story…" : status === "draft" ? "Generate story" : status === "failed" ? "Retry generation" : "Resume generation"}</Button>
      <p className="text-xs text-muted-foreground">Save edits before generating. Up to three attempts per story. Interrupted runs can be retried after two minutes.</p>
    </form>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.message && <p role="status" className="text-sm">{state.message}</p>}
    {status !== "draft" && <Button variant="outline" type="button" disabled={pending} onClick={() => router.refresh()}>Refresh status</Button>}
  </div>;
}
