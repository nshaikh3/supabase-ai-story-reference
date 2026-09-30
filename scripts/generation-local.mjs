import { randomBytes, createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { projectId, root, validateBindings } from "./local-config.mjs";

export function ensureGenerationEnvironment() {
  const directory = join(root, "supabase/functions");
  const path = join(directory, ".env");
  mkdirSync(directory, { recursive: true });
  if (!existsSync(path)) writeFileSync(path, `AI_PROVIDER=mock\nGENERATION_WORKER_SECRET=${randomBytes(32).toString("hex")}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(path, 0o600);
  const env = parseEnv(readFileSync(path, "utf8"));
  if (!/^[a-f0-9]{64}$/.test(env.GENERATION_WORKER_SECRET ?? "")) throw new Error("Expected a 256-bit hexadecimal generation secret in supabase/functions/.env.");
  if (!["mock", "gemini"].includes(env.AI_PROVIDER)) throw new Error("AI_PROVIDER must be mock or gemini.");
  return createHash("sha256").update(env.GENERATION_WORKER_SECRET).digest("hex");
}

export function provisionGenerationWorker() {
  const hash = ensureGenerationEnvironment();
  const name = `supabase_db_${projectId}`;
  const inspect = spawnSync("docker", ["inspect", name], { encoding: "utf8", timeout: 20000 });
  if (inspect.status !== 0) throw new Error("Reference database is not running.");
  validateBindings(JSON.parse(inspect.stdout));
  // Fixed local container + validated hex hash only; no raw secret enters SQL/logs.
  const input = `insert into private.generation_worker_key(singleton,key_hash) values (true,'${hash}') on conflict (singleton) do update set key_hash=excluded.key_hash;`;
  const result = spawnSync("docker", ["exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input, encoding: "utf8", timeout: 20000 });
  if (result.status !== 0) throw new Error("Could not provision the local generation worker. Apply Phase 4 migrations with npm run db:reset first.");
  console.log("Local generation worker configured; secret remains in ignored mode-0600 Edge environment.");
}
