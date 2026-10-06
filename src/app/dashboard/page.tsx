import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { WorkspaceNav } from "@/components/workspace-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
const pageSize = 20;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string }> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const page = params.page && /^\d{1,5}$/.test(params.page) ? Math.max(1, Math.min(10000, Number(params.page))) : 1;
  const start = (page - 1) * pageSize;
  const { data, error } = await supabase.from("stories").select("id,title,child_name,status,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + pageSize);
  const stories = data?.slice(0, pageSize) ?? [];
  return <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
    <WorkspaceNav />
    <div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Your private workspace</p><h1 className="text-4xl font-semibold tracking-tight">My stories</h1><p className="mt-4 text-muted-foreground">Every adventure starts with an idea.</p></div><Button asChild><Link href="/stories/new" prefetch={false}>New story</Link></Button></div>
    {params.deleted === "1" && <p role="status" className="mb-6 rounded-lg bg-secondary p-4">Story deleted.</p>}
    {error ? <p role="alert" className="rounded-xl border p-6">We couldn’t load your stories. Please reload and try again.</p> : stories.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{stories.map(story => <Card key={story.id} className="flex flex-col">
      <CardHeader><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">{story.status}</p><CardTitle className="break-words text-xl"><Link href={`/stories/${story.id}`} className="hover:underline" prefetch={false}>{story.title}</Link></CardTitle></CardHeader>
      <CardContent><p className="break-words text-sm text-muted-foreground">Starring {story.child_name}</p><p className="mt-4 text-xs text-muted-foreground">Created {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(story.created_at))}</p></CardContent>
    </Card>)}</div> : <Card><CardContent className="py-12 text-center"><h2 className="text-xl font-semibold">{page > 1 ? "No stories on this page" : "Your first adventure awaits"}</h2><p className="mt-3 text-muted-foreground">{page > 1 ? "Return to an earlier page to see your stories." : "Create a story, introduce your hero, and add an illustration."}</p></CardContent></Card>}
    {!error && (page > 1 || (data?.length ?? 0) > pageSize) && <nav aria-label="Story pages" className="mt-8 flex items-center gap-6 text-sm">{page > 1 && <Link href={`/dashboard?page=${page - 1}`} prefetch={false}>Previous page</Link>}<span>Page {page}</span>{(data?.length ?? 0) > pageSize && <Link href={`/dashboard?page=${page + 1}`} prefetch={false}>Next page</Link>}</nav>}
    <p className="mt-10 text-sm leading-relaxed text-muted-foreground">Open a story to edit your draft, add a private illustration, or generate five pages. Open story tabs receive live progress updates.</p>
  </main>;
}
