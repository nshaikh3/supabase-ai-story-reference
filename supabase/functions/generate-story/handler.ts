import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { boundedJson, GenerationError, generatorFor, record, validateOutput, type StoryGenerator } from "../_shared/generator.ts";

type Dependencies = { env: (key: string) => string | undefined; client?: (authorization: string) => SupabaseClient; provider?: { name: "mock" | "gemini"; generator: StoryGenerator } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (status: number, value: Record<string, unknown>) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });

export function createHandler(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return respond(405, { error: "method_not_allowed" });
    const authorization = request.headers.get("Authorization") ?? "";
    if (!/^Bearer [a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(authorization)) return respond(401, { error: "unauthorized" });
    let client: SupabaseClient;
    const secret = dependencies.env("GENERATION_WORKER_SECRET") ?? "";
    try {
      if (!/^[a-f0-9]{64}$/.test(secret)) return respond(503, { error: "configuration_error" });
      if (dependencies.client) client = dependencies.client(authorization);
      else {
        const key = JSON.parse(dependencies.env("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;
        if (typeof key !== "string" || !key.startsWith("sb_publishable_")) return respond(503, { error: "configuration_error" });
        client = createClient(dependencies.env("SUPABASE_URL")!, key,
          { global: { headers: { Authorization: authorization }, fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
        );
      }
      // The gateway is an additional check, never the only user-auth check.
      const { data, error } = await client.auth.getUser(authorization.slice(7));
      if (error || !data.user) return respond(401, { error: "unauthorized" });
    } catch { return respond(503, { error: "authentication_unavailable" }); }
    if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json") return respond(415, { error: "expected_json" });
    let body: unknown;
    try { body = await boundedJson(new Response(request.body), 1024); } catch { return respond(400, { error: "invalid_request" }); }
    if (!record(body) || typeof body.story_id !== "string" || !uuid.test(body.story_id) || Object.keys(body).some(key => key !== "story_id")) return respond(400, { error: "invalid_request" });
    let jobId: string | null = null;
    let claimed = false;
    try {
      const story = await client.from("stories").select("id,title,child_name,prompt,status").eq("id", body.story_id).maybeSingle();
      if (story.error) return respond(503, { error: "database_unavailable" });
      if (!story.data) return respond(404, { error: "story_unavailable" });
      if (story.data.status === "complete") return respond(200, { status: "complete" });
      const job = await client.rpc("enqueue_generation", { p_story_id: body.story_id });
      if (job.error) return respond(503, { error: "database_unavailable" });
      if (!job.data) return respond(409, { error: "attempts_exhausted" });
      jobId = job.data as string;
      const provider = dependencies.provider ?? generatorFor(dependencies.env);
      // Only worker RPCs receive the capability; Auth and ordinary reads do not.
      const claim = await client.rpc("claim_generation", { p_job_id: jobId, p_provider: provider.name }).setHeader("x-generation-worker", secret);
      if (claim.error) return respond(503, { error: "database_unavailable", job_id: jobId });
      if (!claim.data) return respond(202, { status: "in_progress", job_id: jobId });
      claimed = true;
      // Re-read after the atomic claim: a stale pre-enqueue read must not select input.
      const input = await client.from("stories").select("title,child_name,prompt").eq("id", body.story_id).single();
      if (input.error || !input.data) throw new GenerationError("database_write_failed");
      const output = validateOutput(await provider.generator.generate(input.data));
      const finish = await client.rpc("finish_generation", { p_job_id: jobId, p_pages: output.pages }).setHeader("x-generation-worker", secret);
      if (finish.error) throw new GenerationError("database_write_failed");
      if (!finish.data) return respond(409, { error: "job_no_longer_active", job_id: jobId });
      return respond(200, { status: "complete", job_id: jobId });
    } catch (error) {
      const code = error instanceof GenerationError ? error.code : "database_write_failed";
      if (claimed && jobId) {
        // Failure reporting is best effort. A lost/expired lease is recovered by
        // the next explicit enqueue; never overwrite a completed or newer job.
        try { await client.rpc("finish_generation", { p_job_id: jobId, p_error_code: code }).setHeader("x-generation-worker", secret); } catch { /* no raw errors or input in logs */ }
      }
      return respond(503, { error: code, ...(jobId ? { job_id: jobId } : {}) });
    }
  };
}
