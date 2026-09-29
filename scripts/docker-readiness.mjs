import { setTimeout as sleep } from "node:timers/promises";
import { projectId } from "./local-config.mjs";

export function readinessContainer(args, inspectedName = args[1]) {
  // Exact command and project match. No interception of other Docker operations.
  const expected = `supabase_storage_${projectId}`;
  const validTarget = args[1] === expected || /^[a-f0-9]{64}$/.test(args[1] ?? "");
  return args.length === 2 && args[0] === "start" && validTarget && inspectedName?.replace(/^\//, "") === expected ? expected : null;
}

/**
 * @param {() => Promise<{Running: boolean, OOMKilled?: boolean, Health?: {Status: string}}>} readState
 * @param {{now?: () => number, signal?: AbortSignal, pause?: (ms: number) => Promise<unknown>, timeout?: number}} [options]
 */
export async function waitForStorage(readState, { now = Date.now, signal, pause = ms => sleep(ms, undefined, { signal }), timeout = 300000 } = {}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    signal?.throwIfAborted();
    const state = await readState();
    if (!state.Running || state.OOMKilled || !state.Health) throw new Error("Reference Storage stopped or has no health probe.");
    if (state.Health.Status === "healthy") return;
    await pause(2000);
  }
  throw new Error("Reference Storage did not become healthy within five minutes. Free local resources and retry; health checks were not bypassed.");
}
