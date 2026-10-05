import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectId, root, validateBindings } from "./local-config.mjs";
import { parsePerformanceOutput } from "./performance-report.mjs";

// Called only through the fixed local wrapper after config/socket validation.
export function reviewPerformance() {
  const name = `supabase_db_${projectId}`;
  const inspected = spawnSync("docker", ["inspect", name], { encoding: "utf8", timeout: 20000 });
  if (inspected.status !== 0) throw new Error("Reference database is not running.");
  validateBindings(JSON.parse(inspected.stdout));
  const input = readFileSync(join(root, "supabase/tests/performance/owner-queries.sql"), "utf8");
  const result = spawnSync("docker", ["exec", "-i", name, "psql", "-X", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", timeout: 180000, maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Local performance review failed; the connection rolls back its fixture transaction. Run db:reset before retrying. Raw database diagnostics were withheld.");
  const report = { measuredAt: new Date().toISOString(), ...parsePerformanceOutput(result.stdout) };
  const directory = join(root, "test-results");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "database-performance.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Verified ${report.queries.length} authenticated RLS plans and fixture rollback. Report: test-results/database-performance.json`);
  for (const query of report.queries) console.log(`${query.name}: ${query.rows} rows, ${query.executionMs} ms, ${query.sharedHits} shared hits, ${query.sharedReads} reads`);
}
