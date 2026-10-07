import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database";
import { ASSET_BUCKET } from "./validation";
import { resourceError } from "./resources";

type Client = SupabaseClient<Database>;

// Only caller-owned, database-returned paths enter here. A failed removal keeps
// the reservation for retry. Storage's idempotent remove also accepts absent files.
export async function removeStoryObjects(supabase: Client, paths: string[]) {
  if (!paths.length) return true;
  try {
    const { error } = await supabase.storage.from(ASSET_BUCKET).remove(paths);
    return !error;
  } catch { return false; }
}

export async function uploadReservedImage(supabase: Client, storyId: string, ownerId: string, bytes: Buffer) {
  const path = `${ownerId}/${storyId}/${crypto.randomUUID()}.webp`;
  const { data: asset, error } = await supabase.from("assets").insert({ story_id: storyId, kind: "hero", storage_path: path, mime_type: "image/webp" }).select("id").single();
  if (error || !asset) return { error: resourceError(error) ?? "An image is already attached, or this story is unavailable. Remove the current image before uploading another." };
  try {
    const { error: uploadError } = await supabase.storage.from(ASSET_BUCKET).upload(path, bytes, { contentType: "image/webp", cacheControl: "0", upsert: false });
    if (!uploadError) return { message: "Hero image uploaded." };
  } catch { /* Preserve the reservation when the transport outcome is uncertain. */ }
  // Don't silently drop a reservation after an ambiguous network failure. The
  // owner can explicitly remove it (Storage first) and then try a fresh path.
  return { error: "The image upload did not complete. Remove the image below, then try again.", retainedImage: true };
}
