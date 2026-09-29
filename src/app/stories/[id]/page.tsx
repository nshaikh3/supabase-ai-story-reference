import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { validId } from "@/lib/stories/validation";
import { StoryForm, HeroForm, DeleteStoryForm } from "@/components/story-forms";
import { WorkspaceNav } from "@/components/workspace-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export default async function StoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  const { id } = await params;
  if (!validId(id)) notFound();
  const { data: story, error } = await supabase.from("stories").select("id,title,child_name,prompt,status").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error) throw new Error("Story lookup unavailable");
  if (!story) notFound();
  const [assets, pages] = await Promise.all([
    supabase.from("assets").select("id").eq("story_id", id).eq("kind", "hero").maybeSingle(),
    supabase.from("story_pages").select("id,page_number,content").eq("story_id", id).order("page_number"),
  ]);
  if (assets.error || pages.error) throw new Error("Story content unavailable");
  return <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10"><WorkspaceNav />
    <Link href="/dashboard" className="text-sm text-primary" prefetch={false}>← My stories</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-primary">{story.status}</p><h1 className="mb-8 mt-3 break-words text-4xl font-semibold tracking-tight">{story.title}</h1>
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]"><Card><CardHeader><CardTitle>Story details</CardTitle></CardHeader><CardContent><StoryForm id={id} initial={story} /></CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Hero illustration</CardTitle></CardHeader><CardContent><HeroForm id={id} assetId={assets.data?.id} /></CardContent></Card><Card><CardHeader><CardTitle>The next chapter</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">Your draft is saved. AI generation and live progress will arrive in the next phases.</p></CardContent></Card></div>
    </div>
    {Boolean(pages.data?.length) && <section className="mt-10 space-y-6" aria-label="Story pages"><h2 className="text-2xl font-semibold">Your story</h2>{pages.data?.map(page => <Card key={page.id}><CardHeader><CardTitle>Page {page.page_number}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words leading-relaxed">{page.content}</p></CardContent></Card>)}</section>}
    <section className="mt-12 rounded-xl border p-6" aria-label="Delete this story"><h2 className="mb-4 text-lg font-semibold">Delete this story</h2><DeleteStoryForm id={id} /></section>
  </main>;
}
