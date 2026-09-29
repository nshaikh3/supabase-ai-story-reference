import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), remove: vi.fn(), refresh: vi.fn(), normalize: vi.fn(), upload: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/stories/storage", () => ({ removeStoryObjects: mocks.remove, uploadReservedImage: mocks.upload }));
vi.mock("@/lib/stories/image", () => ({ normalizeImage: mocks.normalize }));
import { createStory, updateStory, uploadHero, deleteStory, removeHero } from "@/app/stories/actions";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const assetId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const responses: unknown[] = [];
const queries: { table: string; operations: unknown[][] }[] = [];
const from = vi.fn((table: string) => {
  const query = { table, operations: [] as unknown[][] }; queries.push(query);
  const builder: Record<string, unknown> = {};
  for (const op of ["select", "insert", "update", "delete", "eq"]) builder[op] = (...args: unknown[]) => { query.operations.push([op, ...args]); return builder; };
  builder.single = builder.maybeSingle = () => Promise.resolve(responses.shift());
  builder.then = (resolve: (value: unknown) => void) => Promise.resolve(responses.shift()).then(resolve);
  return builder;
});
function details() { const f = new FormData(); f.set("title", "Map"); f.set("child_name", "Nova"); f.set("prompt", "Adventure"); return f; }
function deletion() { const f = new FormData(); f.set("confirm", "delete"); return f; }
beforeEach(() => { vi.clearAllMocks(); responses.length = 0; queries.length = 0; mocks.requireUser.mockResolvedValue({ supabase: { from }, user: { id: "owner" } }); mocks.remove.mockResolvedValue(true); });
describe("authorized story actions", () => {
  it("rejects malformed input and requires deletion intent", async () => {
    expect((await createStory({}, new FormData())).error).toBeTruthy();
    expect((await updateStory("../", {}, details())).error).toBeTruthy();
    expect((await deleteStory(id, {}, new FormData())).error).toContain("Confirm");
    expect(from).not.toHaveBeenCalled();
  });
  it("requires verified identity before accessing story data", async () => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));
    await expect(createStory({}, details())).rejects.toThrow("REDIRECT:/sign-in"); expect(from).not.toHaveBeenCalled();
  });
  it("updates only allowed fields, and treats zero affected rows as failure", async () => {
    responses.push({ data: null, error: null }); const f = details(); f.set("status", "complete");
    expect((await updateStory(id, {}, f)).error).toContain("unavailable");
    expect(queries[0].operations).toContainEqual(["update", { title: "Map", child_name: "Nova", prompt: "Adventure" }]);
    expect(queries[0].operations).toContainEqual(["eq", "owner_id", "owner"]);
  });
  it("checks ownership before processing an upload", async () => {
    responses.push({ data: null, error: null });
    expect((await uploadHero(id, {}, new FormData())).error).toContain("unavailable"); expect(mocks.normalize).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("retains story and metadata when byte deletion fails", async () => {
    responses.push({ data: { id }, error: null }, { data: [{ storage_path: "database-owned-path" }], error: null }); mocks.remove.mockResolvedValue(false);
    expect((await deleteStory(id, {}, deletion())).error).toContain("story was kept");
    expect(queries.flatMap(q => q.operations).some(op => op[0] === "delete")).toBe(false);
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), ["database-owned-path"]);
  });
  it("never accepts a submitted object path for removal", async () => {
    responses.push({ data: { id: assetId, storage_path: "checked-path" }, error: null }, { data: [{ id: assetId }], error: null });
    expect((await removeHero(id, assetId)).message).toContain("removed"); expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), ["checked-path"]);
  });
  it("reports a database deletion failure without claiming success", async () => {
    responses.push({ data: { id }, error: null }, { data: [], error: null }, { data: null, error: { message: "private trigger error" } });
    expect((await deleteStory(id, {}, deletion())).error).toContain("incomplete");
  });
  it("deletes a checked story after cleanup and refreshes the dashboard", async () => {
    responses.push({ data: { id }, error: null }, { data: [], error: null }, { data: [{ id }], error: null });
    await expect(deleteStory(id, {}, deletion())).rejects.toThrow("REDIRECT:/dashboard?deleted=1"); expect(mocks.refresh).toHaveBeenCalledWith("/dashboard");
  });
});
