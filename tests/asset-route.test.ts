import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), asset: vi.fn(), bucket: vi.fn(), download: vi.fn(), normalize: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/stories/image", () => ({ normalizeImage: mocks.normalize }));
import { GET } from "@/app/assets/[id]/route";

const id = "11111111-1111-4111-8111-111111111111";
const path = "synthetic-owner/synthetic-story/reserved.webp";
const invoke = (assetId = id) => GET(new Request(`http://127.0.0.1:3100/assets/${assetId}?path=untrusted`), { params: Promise.resolve({ id: assetId }) });
function privateHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, from: mocks.from, storage: { from: mocks.bucket } });
  mocks.user.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.asset });
  mocks.asset.mockResolvedValue({ data: { storage_path: path, mime_type: "image/webp" }, error: null });
  mocks.bucket.mockReturnValue({ download: mocks.download });
  mocks.download.mockResolvedValue({ data: new Blob(["raw-upload"]), error: null });
  mocks.normalize.mockResolvedValue(Buffer.from("normalized-pixels"));
});
describe("private image response boundary", () => {
  it("rejects malformed IDs before any client or decoder work", async () => {
    const response = await invoke("bad-id");
    expect(response.status).toBe(404); privateHeaders(response);
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.normalize).not.toHaveBeenCalled();
  });
  it.each([false, true])("requires verified Auth before metadata reads (error=%s)", error => {
    mocks.user.mockResolvedValue({ data: { user: error ? { id } : null }, error: error ? { message: "private error" } : null });
    return invoke().then(async response => {
      expect(response.status).toBe(404); expect(await response.text()).toBe("Image unavailable"); privateHeaders(response);
      expect(mocks.from).not.toHaveBeenCalled();
    });
  });
  it.each([false, true])("does not download missing or denied metadata (error=%s)", async error => {
    mocks.asset.mockResolvedValue({ data: error ? { storage_path: path } : null, error: error ? { message: "private error" } : null });
    const response = await invoke();
    expect(response.status).toBe(404); privateHeaders(response); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("uses only RLS-returned paths and serves transformed bytes with private headers", async () => {
    const response = await invoke();
    expect(response.status).toBe(200); privateHeaders(response);
    expect(mocks.from).toHaveBeenCalledWith("assets"); expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.bucket).toHaveBeenCalledWith("story-assets"); expect(mocks.download).toHaveBeenCalledWith(path);
    expect(mocks.normalize).toHaveBeenCalledWith(Buffer.from("raw-upload"), "image/webp");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="hero.webp"');
    expect(await response.text()).toBe("normalized-pixels");
  });
  it.each(["client", "user", "asset", "download", "normalize"] as const)("contains thrown %s failures without logging private details", async stage => {
    mocks[stage].mockRejectedValue(new Error("synthetic-private-token-and-path"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await invoke();
    expect(response.status).toBe(404); expect(await response.text()).toBe("Image unavailable"); privateHeaders(response);
    expect(log).not.toHaveBeenCalled();
  });
  it.each([false, true])("does not decode missing or denied downloads (error=%s)", async error => {
    mocks.download.mockResolvedValue({ data: error ? new Blob(["raw"]) : null, error: error ? { message: "private error" } : null });
    const response = await invoke();
    expect(response.status).toBe(404); privateHeaders(response); expect(mocks.normalize).not.toHaveBeenCalled();
  });
  it("contains thrown body-read failures", async () => {
    mocks.download.mockResolvedValue({ data: { arrayBuffer: () => Promise.reject(new Error("private transport detail")) }, error: null });
    const response = await invoke();
    expect(response.status).toBe(404); privateHeaders(response); expect(mocks.normalize).not.toHaveBeenCalled();
  });
});
