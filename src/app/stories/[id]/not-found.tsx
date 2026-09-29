import Link from "next/link";
export default function StoryNotFound() {
  return <main className="mx-auto max-w-2xl px-6 py-20"><h1 className="text-3xl font-semibold">Story unavailable</h1><p className="my-5 text-muted-foreground">This story doesn’t exist or isn’t available to your account.</p><Link href="/dashboard" className="text-primary" prefetch={false}>Return to my stories</Link></main>;
}
