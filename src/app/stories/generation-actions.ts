"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { validId, type StoryState } from "@/lib/stories/validation";

export async function generateStory(id: string): Promise<StoryState> {
  if (!validId(id)) return { error: "This story is unavailable." };
  const { supabase } = await requireUser();
  const { data: jobId, error } = await supabase.rpc("enqueue_generation", { p_story_id: id });
  if (error || !jobId) {
    // Another tab may have completed the story, or enqueue may have expired the
    // third attempt. Refresh those committed states even without an Edge call.
    revalidatePath(`/stories/${id}`);
    revalidatePath("/dashboard");
    return { error: "Generation is unavailable. A completed story cannot be regenerated, and each story allows three attempts." };
  }
  let state: StoryState;
  try {
    const result = await supabase.functions.invoke("generate-story", { body: { story_id: id }, timeout: 55_000 });
    if (result.error) state = { error: "Generation did not finish successfully. Check the status below. If the run was interrupted, wait two minutes, then retry." };
    else if (result.data?.status === "complete") state = { message: "Your five-page story is ready." };
    else state = { message: "Generation is already running. Refresh the status shortly. If interrupted, retry after two minutes." };
  } catch { state = { error: "We lost the connection to generation. Refresh the status before retrying; an interrupted run can be retried after two minutes." }; }
  revalidatePath(`/stories/${id}`);
  revalidatePath("/dashboard");
  return state;
}
