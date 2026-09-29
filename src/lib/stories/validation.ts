export type StoryValues = { title: string; child_name: string; prompt: string };
export type StoryState = { error?: string; message?: string; values?: StoryValues; retainedImage?: boolean };
export const emptyStory: StoryValues = { title: "", child_name: "", prompt: "" };
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ASSET_BUCKET = "story-assets";

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function readStory(form: FormData): StoryState & { values: StoryValues } {
  const values = { ...emptyStory };
  for (const [key, limit] of [["title", 120], ["child_name", 80], ["prompt", 2000]] as const) {
    const raw = form.get(key);
    values[key] = typeof raw === "string" ? raw.trim().slice(0, limit + 1) : "";
  }
  const valid = values.title && values.title.length <= 120 && values.child_name && values.child_name.length <= 80 && values.prompt && values.prompt.length <= 2000;
  return { values, ...(!valid ? { error: "Enter a title (1–120 characters), hero name (1–80), and prompt (1–2,000)." } : {}) };
}

export function imageInputError(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) return "Choose a PNG, JPEG, or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Choose an image of 2 MiB or smaller.";
  if (!IMAGE_TYPES.some(type => type === file.type)) return "Choose a PNG, JPEG, or WebP image.";
  return null;
}
