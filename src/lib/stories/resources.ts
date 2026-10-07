import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database";

export function resourceError(error: { code?: string } | null | undefined) {
  if (error?.code === "PT429") return "The workspace limit has been reached. Please try again later, or remove an unused story if your library is full.";
  if (error?.code === "PT503") return "This operation is temporarily paused. Please try again later.";
  return undefined;
}

export class ImageAdmissionError extends Error {
  constructor(public readonly status: 429 | 503) { super("Image processing is temporarily unavailable."); }
}

export async function withImageLease<T>(supabase: SupabaseClient<Database>, storyId: string, work: () => Promise<T>): Promise<T> {
  const { data: lease, error } = await supabase.rpc("admit_image_processing", { p_story_id: storyId }).abortSignal(AbortSignal.timeout(10_000));
  if (error || !lease) throw new ImageAdmissionError(error?.code === "PT429" ? 429 : 503);
  try { return await work(); }
  finally {
    // A failed release is bounded by the 60s DB lease. Never retry work or expose
    // transport details when release fails after a successful transform.
    try { await supabase.rpc("release_image_processing", { p_lease_id: lease }).abortSignal(AbortSignal.timeout(10_000)); } catch { /* lease expires */ }
  }
}
