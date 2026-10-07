import { createClient } from "@/lib/supabase/server";
import { ASSET_BUCKET, validId } from "@/lib/stories/validation";
import { normalizeImage } from "@/lib/stories/image";
import { ImageAdmissionError, withImageLease } from "@/lib/stories/resources";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new Response("Image unavailable", { status: 404, headers });
  if (!validId(id)) return missing();
  try {
    const supabase = await createClient({ timeoutMs: 10_000 });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return missing();
    const { data: asset, error } = await supabase.from("assets").select("story_id,storage_path,mime_type").eq("id", id).maybeSingle();
    if (error || !asset) return missing();
    return await withImageLease(supabase, asset.story_id, async () => {
      const { data, error: downloadError } = await supabase.storage.from(ASSET_BUCKET).download(asset.storage_path);
      if (downloadError || !data) return missing();
    // Direct Storage callers can spoof Content-Type. Revalidate at the display
    // boundary too; the app only serves decoded raster pixels, never raw uploads.
    const bytes = await normalizeImage(Buffer.from(await data.arrayBuffer()), asset.mime_type);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="hero.webp"' } });
    });
  } catch (error) {
    if (error instanceof ImageAdmissionError) return new Response("Image processing is temporarily unavailable", { status: error.status, headers: { ...headers, "Retry-After": "60" } });
    // Dependency exceptions can contain URLs, tokens or object paths. Preserve
    // the same private response as a denied/missing object without logging them.
    return missing();
  }
}
