"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { imageInputError, readStory, validId, type StoryState } from "@/lib/stories/validation";
import { normalizeImage } from "@/lib/stories/image";
import { removeStoryObjects, uploadReservedImage } from "@/lib/stories/storage";

function refresh(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/account");
  if (id) revalidatePath(`/stories/${id}`);
}
const unavailable = "This story is unavailable. Return to your dashboard and try again.";

export async function createStory(_state: StoryState, form: FormData): Promise<StoryState> {
  const input = readStory(form);
  if (input.error) return input;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("stories").insert(input.values).select("id").single();
  if (error || !data) return { ...input, error: "We couldn’t create your story. Please try again." };
  refresh();
  redirect(`/stories/${data.id}`);
}

export async function updateStory(id: string, _state: StoryState, form: FormData): Promise<StoryState> {
  if (!validId(id)) return { error: unavailable };
  const input = readStory(form);
  if (input.error) return input;
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("stories").update(input.values).eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ...input, error: unavailable };
  refresh(id);
  return { values: input.values, message: "Story details saved." };
}

export async function uploadHero(id: string, _state: StoryState, form: FormData): Promise<StoryState> {
  if (!validId(id)) return { error: unavailable };
  const { supabase, user } = await requireUser();
  const { data: story, error } = await supabase.from("stories").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error || !story) return { error: unavailable };
  const file = form.get("image");
  const fileError = imageInputError(file);
  if (fileError) return { error: fileError };
  let bytes: Buffer;
  try { bytes = await normalizeImage(Buffer.from(await (file as File).arrayBuffer()), (file as File).type); }
  catch { return { error: "We couldn’t read that image. Use a still PNG, JPEG, or WebP under 2 MiB and 16 megapixels." }; }
  const result = await uploadReservedImage(supabase, id, user.id, bytes);
  refresh(id);
  return result;
}

export async function removeHero(id: string, assetId: string): Promise<StoryState> {
  if (!validId(id) || !validId(assetId)) return { error: unavailable };
  const { supabase } = await requireUser();
  const { data: asset, error } = await supabase.from("assets").select("id,storage_path").eq("id", assetId).eq("story_id", id).eq("kind", "hero").maybeSingle();
  if (error || !asset) return { error: unavailable };
  if (!await removeStoryObjects(supabase, [asset.storage_path])) return { error: "We couldn’t finish removing the stored image. Your story record was kept. Try again." };
  const { data, error: deleteError } = await supabase.from("assets").delete().eq("id", asset.id).select("id");
  refresh(id);
  if (deleteError || !data?.length) return { error: "Image cleanup is incomplete. Please try removing it again." };
  return { message: "Hero image removed." };
}

export async function deleteStory(id: string, _state: StoryState, form: FormData): Promise<StoryState> {
  if (!validId(id)) return { error: unavailable };
  if (form.get("confirm") !== "delete") return { error: "Confirm deletion before continuing." };
  const { supabase, user } = await requireUser();
  const { data: story, error: storyError } = await supabase.from("stories").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (storyError || !story) return { error: unavailable };
  const { data: assets, error } = await supabase.from("assets").select("storage_path").eq("story_id", id);
  if (error) return { error: "We couldn’t check your images. Please try again." };
  if (!await removeStoryObjects(supabase, (assets ?? []).map(asset => asset.storage_path))) return { error: "We couldn’t remove the stored images. Your story was kept. Please try again." };
  const { data, error: deleteError } = await supabase.from("stories").delete().eq("id", id).eq("owner_id", user.id).select("id");
  refresh(id);
  if (deleteError || !data?.length) return { error: "Deletion is incomplete. An upload may still be finishing; please wait and try again." };
  redirect("/dashboard?deleted=1");
}
