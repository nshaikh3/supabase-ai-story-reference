import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { StoryForm } from "@/components/story-forms";
import { WorkspaceNav } from "@/components/workspace-nav";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export default async function NewStory() {
  await requireUser();
  return <main className="mx-auto max-w-4xl px-6 py-8"><WorkspaceNav /><Link href="/dashboard" className="text-sm text-primary" prefetch={false}>← My stories</Link><h1 className="mt-6 text-4xl font-semibold tracking-tight">Start a new story</h1><p className="mb-8 mt-4 text-muted-foreground">Give your adventure a title and a hero. You can add an image after saving.</p><Card><CardContent className="pt-6"><StoryForm /></CardContent></Card></main>;
}
