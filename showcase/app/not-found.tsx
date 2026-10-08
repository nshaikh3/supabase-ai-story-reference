import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-2xl px-6 py-24"><h1 className="text-3xl font-semibold">Page not found</h1><p className="my-6">This public site contains only the read-only demo and architecture tour. The full application runs locally.</p><Link href="/demo" className="text-primary underline">Read the sample story</Link></main>;
}
