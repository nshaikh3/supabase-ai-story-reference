import { createClient } from "@/lib/supabase/server";
import { ASSET_BUCKET, validId } from "@/lib/stories/validation";
import { normalizeImage } from "@/lib/stories/image";

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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return missing();
    const { data: asset, error } = await supabase.from("assets").select("storage_path,mime_type").eq("id", id).maybeSingle();
    if (error || !asset) return missing();
    const { data, error: downloadError } = await supabase.storage.from(ASSET_BUCKET).download(asset.storage_path);
    if (downloadError || !data) return missing();
    // Direct Storage callers can spoof Content-Type. Revalidate at the display
    // boundary too; the app only serves decoded raster pixels, never raw uploads.
    const bytes = await normalizeImage(Buffer.from(await data.arrayBuffer()), asset.mime_type);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="hero.webp"' } });
  } catch {
    // Dependency exceptions can contain URLs, tokens or object paths. Preserve
    // the same private response as a denied/missing object without logging them.
    return missing();
  }
}
