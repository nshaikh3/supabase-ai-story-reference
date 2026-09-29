import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
vi.mock("server-only", () => ({}));
import { removeStoryObjects, uploadReservedImage } from "@/lib/stories/storage";
const upload = vi.fn(); const remove = vi.fn(); const single = vi.fn(); const insert = vi.fn();
const client = { from: vi.fn(() => ({ insert, delete: vi.fn() })), storage: { from: vi.fn(() => ({ upload, remove })) } } as unknown as SupabaseClient<Database>;
beforeEach(() => {
  vi.clearAllMocks(); insert.mockReturnValue({ select: () => ({ single }) }); single.mockResolvedValue({ data: { id: "asset" }, error: null }); upload.mockResolvedValue({ error: null }); remove.mockResolvedValue({ error: null });
});
describe("Storage failure handling", () => {
  it("reserves immutable metadata before uploading with a random path", async () => {
    expect(await uploadReservedImage(client, "story", "owner", Buffer.from("image"))).toEqual({ message: "Hero image uploaded." });
    const reservation = insert.mock.calls[0][0];
    expect(reservation).toMatchObject({ story_id: "story", kind: "hero", mime_type: "image/webp" });
    expect(reservation.storage_path).toMatch(/^owner\/story\/[0-9a-f-]+\.webp$/);
    expect(upload).toHaveBeenCalledWith(reservation.storage_path, expect.any(Buffer), { contentType: "image/webp", cacheControl: "0", upsert: false });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]);
  });
  it("never uploads when reservation fails", async () => {
    single.mockResolvedValue({ data: null, error: { message: "private database details" } });
    expect((await uploadReservedImage(client, "story", "owner", Buffer.from("image"))).error).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
  });
  it.each(["provider", "transport"])("keeps metadata for retry after %s upload failure", async kind => {
    if (kind === "provider") upload.mockResolvedValue({ error: { message: "private" } });
    else upload.mockRejectedValue(new Error("private"));
    const result = await uploadReservedImage(client, "story", "owner", Buffer.from("image"));
    expect(result.error).toContain("Remove the image"); expect(JSON.stringify(result)).not.toContain("private"); expect(remove).not.toHaveBeenCalled();
  });
  it("does not hide failed or uncertain removals", async () => {
    expect(await removeStoryObjects(client, [])).toBe(true); expect(remove).not.toHaveBeenCalled();
    remove.mockResolvedValue({ error: { message: "unavailable" } }); expect(await removeStoryObjects(client, ["owned-path"])).toBe(false);
    remove.mockRejectedValue(new Error("uncertain")); expect(await removeStoryObjects(client, ["owned-path"])).toBe(false);
  });
});
