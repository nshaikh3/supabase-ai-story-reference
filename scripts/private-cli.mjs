import { spawnSync } from "node:child_process";

// Supabase startup prints local privileged credentials on success, and error
// diagnostics may contain arbitrary service output. Neither stream is safe to
// replay. Keep only process status; do not write a raw diagnostic file.
/** @param {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptions) => {status?: number | null, error?: {code?: string}}} run */
export function runPrivateCli(command, args, options, run = spawnSync) {
  const result = run(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) {
    const code = ["ETIMEDOUT", "ENOBUFS", "ENOENT", "EACCES"].includes(result.error.code) ? result.error.code : "PROCESS_ERROR";
    throw new Error(`Reference startup failed (${code}); credential-bearing CLI output was withheld.`);
  }
  if (result.status !== 0) {
    const status = Number.isInteger(result.status) ? result.status : "interrupted";
    throw new Error(`Reference startup failed (exit ${status}); credential-bearing CLI output was withheld. Check reference-container health before retrying.`);
  }
  return { status: 0 };
}
