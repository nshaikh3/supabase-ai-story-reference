"use client";

import { useActionState, useState } from "react";
import { createStory, updateStory, uploadHero, removeHero, deleteStory } from "@/app/stories/actions";
import { emptyStory, imageInputError, type StoryState, type StoryValues } from "@/lib/stories/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Feedback({ state }: { state: StoryState }) {
  return <>{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state.message && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{state.message}</p>}</>;
}

export function StoryForm({ id, initial = emptyStory }: { id?: string; initial?: StoryValues }) {
  const [state, action, pending] = useActionState<StoryState, FormData>(id ? updateStory.bind(null, id) : createStory, {});
  const values = state.values ?? initial;
  return <form action={action} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="title">Story title</Label><Input id="title" name="title" required maxLength={120} defaultValue={values.title} placeholder="The moonlight map" /></div>
    <div className="space-y-2"><Label htmlFor="child_name">Hero’s first name</Label><Input id="child_name" name="child_name" required maxLength={80} defaultValue={values.child_name} placeholder="Nova" aria-describedby="name-hint" /><p id="name-hint" className="text-sm text-muted-foreground">Use a fictional name for this reference app.</p></div>
    <div className="space-y-2"><Label htmlFor="prompt">Story idea</Label><Textarea id="prompt" name="prompt" required maxLength={2000} rows={6} defaultValue={values.prompt} placeholder="A curious explorer follows a glowing map through a friendly forest…" aria-describedby="prompt-hint" /><p id="prompt-hint" className="text-sm text-muted-foreground">Up to 2,000 characters. Describe the setting and adventure.</p></div>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : id ? "Save story details" : "Create story"}</Button>
  </form>;
}

export function HeroForm({ id, assetId }: { id: string; assetId?: string }) {
  const [state, action, pending] = useActionState<StoryState, FormData>(uploadHero.bind(null, id), {});
  const [fileError, setFileError] = useState<string | null>(null);
  return <div className="space-y-5">
    <p className="text-sm leading-relaxed text-muted-foreground">Add an optional illustration for your hero. Use a synthetic image for this demo. Only your account can view it.</p>
    {assetId ? <HeroPreview key={assetId} id={id} assetId={assetId} /> : <form action={action} className="space-y-4" onSubmit={event => {
      const error = imageInputError(new FormData(event.currentTarget).get("image"));
      setFileError(error);
      if (error) event.preventDefault();
    }}>
      <Label htmlFor="image">Hero image</Label>
      <Input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp" required aria-describedby="image-hint" onChange={() => setFileError(null)} />
      <p id="image-hint" className="text-sm text-muted-foreground">Still PNG, JPEG, or WebP. Maximum 2 MiB and 16 megapixels. Images are resized and location metadata is removed.</p>
      {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Uploading…" : "Upload hero image"}</Button>
    </form>}
    <Feedback state={{ error: state.retainedImage && !assetId ? undefined : state.error, message: assetId ? state.message : undefined }} />
  </div>;
}

function HeroPreview({ id, assetId }: { id: string; assetId: string }) {
  const [failed, setFailed] = useState(false);
  const [state, action, pending] = useActionState<StoryState, FormData>(removeHero.bind(null, id, assetId), {});
  return <div className="space-y-4">
    {failed ? <p className="rounded-lg bg-secondary p-4 text-sm">The image is unavailable or the upload was interrupted. Remove it and upload again.</p> :
      // Authenticated route checks the current session on every request. Avoid a
      // shared image optimizer cache, which cannot carry this authorization.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/assets/${assetId}`} alt="Your story’s hero illustration" width={480} height={360} className="max-h-80 w-full rounded-lg border object-contain" onError={() => setFailed(true)} />}
    <form action={action} className="space-y-4"><Feedback state={state} /><Button type="submit" variant="outline" disabled={pending}>{pending ? "Removing…" : "Remove hero image"}</Button></form>
  </div>;
}

export function DeleteStoryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<StoryState, FormData>(deleteStory.bind(null, id), {});
  return <form action={action} className="space-y-4">
    <p className="text-sm text-muted-foreground">Permanently delete this story, its pages, and its images.</p>
    <label className="flex items-start gap-3 text-sm"><input className="mt-1 accent-primary" type="checkbox" name="confirm" value="delete" required />I understand this cannot be undone.</label>
    <Feedback state={state} /><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Delete story"}</Button>
  </form>;
}
