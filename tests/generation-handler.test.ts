import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "../supabase/functions/generate-story/handler";
import { GenerationError, MockStoryGenerator } from "../supabase/functions/_shared/generator";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const jobId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const story = { id, title: "Moon map", child_name: "Nova", prompt: "A garden", status: "draft" };
function fixture() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: story, error: null }), single: vi.fn().mockResolvedValue({ data: story, error: null }) };
  const rpc = vi.fn().mockImplementation(async (operation: string) => ({ data: operation === "enqueue_generation" ? jobId : true, error: null }));
  const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null }) };
  const workerHeaders = vi.fn();
  const client = { from: vi.fn().mockReturnValue(query), rpc: (name: string, args: Record<string, unknown>) => {
    const result = rpc(name, args);
    return Object.assign(result, { setHeader: (key: string, value: string) => { workerHeaders(key, value); return result; } });
  }, auth };
  const generator = { generate: vi.fn().mockImplementation(input => new MockStoryGenerator().generate(input)) };
  const handler = createHandler({ env: key => key === "GENERATION_WORKER_SECRET" ? "a".repeat(64) : undefined, client: () => client as unknown as SupabaseClient, provider: { name: "mock", generator } });
  const request = (body: unknown = { story_id: id }, token = "Bearer test.test.test") => new Request("http://local/functions/v1/generate-story", { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { handler, request, query, rpc, auth, generator, client, workerHeaders };
}
describe("authenticated Edge generation", () => {
  it.each(["sb_secret_test-only", ""])("refuses a non-publishable runtime key %#", async key => {
    const handler = createHandler({ env: name => name === "GENERATION_WORKER_SECRET" ? "a".repeat(64) : name === "SUPABASE_PUBLISHABLE_KEYS" ? JSON.stringify({ default: key }) : undefined });
    const response = await handler(fixture().request());
    expect(await response.json()).toEqual({ error: "configuration_error" });
  });
  it("rejects absent bearer and API keys as bearer", async () => {
    const f = fixture();
    expect((await f.handler(f.request({}, ""))).status).toBe(401);
    expect((await f.handler(f.request({}, "Bearer sb_publishable_example"))).status).toBe(401);
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it("rejects forged/expired JWT before database access", async () => {
    const f = fixture(); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "private" } });
    expect((await f.handler(f.request())).status).toBe(401);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([{ story_id: "wrong" }, { story_id: id, owner_id: "someone-else" }, { story_id: id, provider: "gemini" }, null])("rejects untrusted request fields %#", async body => {
    const f = fixture(); expect((await f.handler(f.request(body))).status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects unsupported methods", async () => {
    const f = fixture(); expect((await f.handler(new Request("http://local"))).status).toBe(405);
  });
  it("uses the same unavailable response for missing and RLS-hidden stories", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await f.handler(f.request())).status).toBe(404); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("claims before generation, rereads frozen input and commits five pages", async () => {
    const f = fixture(); const result = await f.handler(f.request());
    expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(await result.json()).toEqual({ status: "complete", job_id: jobId });
    expect(f.query.single).toHaveBeenCalledOnce();
    expect(f.workerHeaders).toHaveBeenCalledTimes(2);
    expect(f.workerHeaders).toHaveBeenCalledWith("x-generation-worker", "a".repeat(64));
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(["enqueue_generation", "claim_generation", "finish_generation"]);
    expect(f.rpc.mock.calls[2][1].p_pages).toHaveLength(5);
    expect(f.rpc.mock.calls[2][1]).not.toHaveProperty("owner_id");
  });
  it("does not run provider for an already claimed job", async () => {
    const f = fixture(); f.rpc.mockImplementation(async operation => ({ data: operation === "enqueue_generation" ? jobId : false, error: null }));
    expect((await f.handler(f.request())).status).toBe(202); expect(f.generator.generate).not.toHaveBeenCalled();
  });
  it("returns existing completion without creating another job", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: { ...story, status: "complete" }, error: null });
    expect((await f.handler(f.request())).status).toBe(200); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["provider_timeout", "invalid_output", "provider_unavailable", "configuration_error"] as const)("records safe failure %s", async code => {
    const f = fixture(); f.generator.generate.mockRejectedValue(new GenerationError(code));
    const response = await f.handler(f.request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: code, job_id: jobId });
    expect(f.rpc).toHaveBeenLastCalledWith("finish_generation", { p_job_id: jobId, p_error_code: code });
  });
  it("handles a failed completion write without leaking database errors", async () => {
    const f = fixture(); f.rpc.mockImplementation(async (name, args) => ({ data: name === "enqueue_generation" ? jobId : true, error: args.p_pages ? { message: "secret internals" } : null }));
    const result = await f.handler(f.request());
    expect(await result.json()).toEqual({ error: "database_write_failed", job_id: jobId });
    expect(f.rpc).toHaveBeenLastCalledWith("finish_generation", { p_job_id: jobId, p_error_code: "database_write_failed" });
  });
  it("survives a second database failure while recording the first", async () => {
    const f = fixture(); f.generator.generate.mockRejectedValue(new Error("private details"));
    f.rpc.mockImplementation(async name => { if (name === "finish_generation") throw Error("database down"); return { data: name === "enqueue_generation" ? jobId : true, error: null }; });
    expect(await (await f.handler(f.request())).json()).toEqual({ error: "database_write_failed", job_id: jobId });
  });
});
