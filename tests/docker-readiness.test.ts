import { describe, expect, it, vi } from "vitest";
import { readinessContainer, waitForService } from "../scripts/docker-readiness.mjs";
const healthy = { Running: true, OOMKilled: false, Health: { Status: "healthy" } };
describe("bounded Storage and Realtime readiness", () => {
  it("targets only the exact reference Storage start", () => {
    expect(readinessContainer(["start", "supabase_storage_supabase-ai-story-reference"])).toBeTruthy();
    for (const args of [["start", "supabase_storage_other"], ["stop", "supabase_storage_supabase-ai-story-reference"], ["start", "supabase_storage_supabase-ai-story-reference", "other"], ["start", "supabase_db_supabase-ai-story-reference"]]) expect(readinessContainer(args)).toBeNull();
  });
  it("accepts a full Docker ID only after exact reference-name inspection", () => {
    const args = ["start", "a".repeat(64)];
    expect(readinessContainer(args)).toBeNull();
    expect(readinessContainer(args, "/supabase_storage_other")).toBeNull();
    expect(readinessContainer(args, "/supabase_storage_supabase-ai-story-reference")).toBe("supabase_storage_supabase-ai-story-reference");
  });
  it("waits on exact reference restart targets and rejects broader operations", () => {
    for (const service of ["storage", "realtime"]) {
      const name = `supabase_${service}_supabase-ai-story-reference`;
      expect(readinessContainer(["restart", name])).toBe(name);
      expect(readinessContainer(["start", name])).toBe(name);
      expect(readinessContainer(["restart", "a".repeat(64)], `/${name}`)).toBe(name);
    }
    for (const args of [["restart", "supabase_realtime_other"], ["restart", "supabase_realtime_supabase-ai-story-reference", "other"], ["stop", "supabase_realtime_supabase-ai-story-reference"], ["restart", "supabase_db_supabase-ai-story-reference"]]) expect(readinessContainer(args)).toBeNull();
  });
  it("honors cancellation", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(waitForService(async () => healthy, { signal: controller.signal })).rejects.toThrow();
  });
  it("waits through cold-start failures and accepts only a healthy probe", async () => {
    const read = vi.fn().mockResolvedValueOnce({ ...healthy, Health: { Status: "unhealthy" } }).mockResolvedValue(healthy);
    const pause = vi.fn(); await waitForService(read, { pause }); expect(read).toHaveBeenCalledTimes(2); expect(pause).toHaveBeenCalledOnce();
  });
  it.each([{ ...healthy, Running: false }, { ...healthy, OOMKilled: true }, { Running: true }])("rejects stopped/OOM/missing health checks", async state => {
    await expect(waitForService(async () => state)).rejects.toThrow("stopped or has no health probe");
  });
  it("fails instead of ignoring a readiness deadline", async () => {
    let time = 0;
    await expect(waitForService(async () => ({ ...healthy, Health: { Status: "starting" } }), { now: () => time, pause: async () => { time += 2000; }, timeout: 4000 })).rejects.toThrow("not bypassed");
  });
});
