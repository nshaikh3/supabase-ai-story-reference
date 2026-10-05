import type { RealtimeChannel, Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database";
import { validId } from "./validation";

export type ConnectionState = "connecting" | "live" | "disconnected";

// Broadcast is an invalidation signal, never the authority for displayed data.
export function isStoryNotification(value: unknown, storyId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  // realtime.send adds a generated message ID to the three application fields.
  return Object.keys(data).sort().join(",") === "id,job_id,status,story_id" &&
    typeof data.id === "string" && validId(data.id) &&
    data.story_id === storyId && typeof data.job_id === "string" && validId(data.job_id) &&
    typeof data.status === "string" && ["queued", "generating", "complete", "failed"].includes(data.status);
}

export function watchStory({ client, storyId, userId, refresh, connection, identityChanged }: {
  client: SupabaseClient<Database>;
  storyId: string;
  userId: string;
  refresh: () => void;
  connection: (state: ConnectionState) => void;
  identityChanged: () => void;
}) {
  let stopped = false;
  let paused = false;
  let revision = 0;
  let channel: RealtimeChannel | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let authTimer: ReturnType<typeof setTimeout> | undefined;

  function reconcile() {
    if (stopped || paused || refreshTimer) return;
    // Coalesce rapid queued/generating/complete notifications; no interval polling.
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      if (!stopped && !paused) refresh();
    }, 100);
  }
  function removeChannel() {
    const previous = channel;
    channel = undefined;
    if (previous) void client.removeChannel(previous).catch(() => {});
  }
  function stop() {
    stopped = true;
    revision++;
    clearTimeout(refreshTimer);
    clearTimeout(authTimer);
    removeChannel();
    auth.data.subscription.unsubscribe();
  }
  async function applySession(session: Session | null) {
    if (stopped) return;
    // This local identity check only controls teardown. Server reads and channel
    // authorization independently validate the JWT and story ownership.
    if (!session || session.user.id !== userId) {
      stop();
      identityChanged();
      return;
    }
    if (paused) return;
    const current = ++revision;
    try {
      await client.realtime.setAuth(session.access_token);
      if (stopped || paused || current !== revision) return;
      if (channel) { reconcile(); return; }
      connection("connecting");
      const next = client.channel(`story:${storyId}`, { config: { private: true } });
      channel = next;
      next.on("broadcast", { event: "generation_status" }, ({ payload }) => {
        if (!stopped && channel === next && isStoryNotification(payload, storyId)) reconcile();
      }).subscribe(status => {
        if (stopped || channel !== next) return;
        if (status === "SUBSCRIBED") {
          connection("live");
          // Includes initial join and every SDK rejoin: recover missed events.
          reconcile();
        } else {
          connection("disconnected");
        }
      });
    } catch {
      if (!stopped && current === revision) connection("disconnected");
    }
  }
  const auth = client.auth.onAuthStateChange((_event, session) => {
    // Don't await another Auth method inside the SDK's auth event callback.
    clearTimeout(authTimer);
    authTimer = setTimeout(() => { void applySession(session); }, 0);
  });
  async function resume() {
    if (stopped) return;
    paused = false;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) { if (!stopped) connection("disconnected"); return; }
      await applySession(data.session);
    } catch { if (!stopped) connection("disconnected"); }
  }
  function pause() {
    if (stopped) return;
    paused = true;
    revision++;
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
    removeChannel();
    connection("disconnected");
  }
  void resume();
  return { stop, resume, pause };
}
