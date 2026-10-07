vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn(), invoke: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { generateStory } from "@/app/stories/generation-actions";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } });
  mocks.rpc.mockResolvedValue({ data: "job-id", error: null });
  mocks.invoke.mockResolvedValue({ data: { status: "complete" }, error: null });
});
describe("generation action", () => {
  it("rejects invalid input without invoking Edge", async () => { expect((await generateStory("bad")).error).toBeTruthy(); expect(mocks.invoke).not.toHaveBeenCalled(); });
  it("requires a user, enqueues before invoking and refreshes result views", async () => {
    expect((await generateStory(id)).message).toContain("ready");
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("enqueue_generation", { p_story_id: id });
    expect(mocks.invoke).toHaveBeenCalledWith("generate-story", { body: { story_id: id }, timeout: 55_000 });
    expect(mocks.revalidate).toHaveBeenCalledWith(`/stories/${id}`);
  });
  it("does not invoke after denied enqueue", async () => { mocks.rpc.mockResolvedValue({ error: { message: "private" } }); expect((await generateStory(id)).error).not.toContain("private"); expect(mocks.invoke).not.toHaveBeenCalled(); });
  it("refreshes a completed or exhausted story even when enqueue returns no job", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await generateStory(id)).error).toContain("three attempts");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith(`/stories/${id}`);
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard");
  });
  it("reports resumable transport failure without leaking credentials", async () => { mocks.invoke.mockRejectedValue(new Error("private bearer")); const state = await generateStory(id); expect(state.error).toContain("Refresh"); expect(state.error).not.toContain("bearer"); });
  it("reports an in-flight duplicate without claiming success", async () => { mocks.invoke.mockResolvedValue({ data: { status: "in_progress" }, error: null }); expect((await generateStory(id)).message).toContain("already running"); });
});
