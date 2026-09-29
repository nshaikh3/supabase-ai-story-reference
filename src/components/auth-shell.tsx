import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-6 py-10 sm:py-16">
    <Link href="/" className="text-sm font-semibold text-primary" prefetch={false}>← Supabase AI Story Reference</Link>
    <Card className="mt-8">
      <CardHeader><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 leading-relaxed text-muted-foreground">{description}</p></CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  </main>;
}
