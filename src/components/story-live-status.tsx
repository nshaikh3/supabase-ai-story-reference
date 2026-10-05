"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { watchStory, type ConnectionState } from "@/lib/stories/realtime";
import { Button } from "@/components/ui/button";

const progress: Record<string, string> = {
  draft: "Ready to generate",
  queued: "Story request received",
  generating: "Generating your story…",
  complete: "Your story is ready",
  failed: "Generation needs attention. Review the latest attempt below.",
};

export function StoryLiveStatus({ id, userId, status }: { id: string; userId: string; status: string }) {
  const router = useRouter();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  useEffect(() => {
    const watcher = watchStory({
      client: createClient(), storyId: id, userId,
      refresh: () => router.refresh(), connection: setConnection,
      // A full navigation removes cached private content after identity changes.
      identityChanged: () => window.location.replace("/sign-in?message=session-changed"),
    });
    const resume = () => { void watcher.resume(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
    window.addEventListener("online", resume);
    window.addEventListener("offline", watcher.pause);
    document.addEventListener("visibilitychange", visibility);
    if (!navigator.onLine) watcher.pause();
    return () => {
      watcher.stop();
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", watcher.pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [id, userId, router]);
  return <div className="space-y-2" aria-label="Live generation status">
    <p role="status" className="text-sm font-medium">{progress[status] ?? "Checking story status"}</p>
    <p className="text-xs text-muted-foreground" data-testid="live-connection">{connection === "live" ? "Live updates connected" : connection === "connecting" ? "Connecting live updates…" : "Live updates disconnected. We’ll catch up when the connection returns."}</p>
    {connection === "disconnected" && <Button variant="outline" type="button" onClick={() => router.refresh()}>Refresh status</Button>}
  </div>;
}
