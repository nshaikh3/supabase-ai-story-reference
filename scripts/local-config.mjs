import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse } from "smol-toml";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const projectId = "supabase-ai-story-reference";
// CLI 2.118.0 uses this name even when --network-id specifies another network.
export const networkId = `supabase_network_${projectId}`;
export const excludedServices = "realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor";

export function validateConfig(config, linked = false) {
  if (linked) throw new Error("Local scripts refuse a linked hosted project. Remove the link before local development.");
  if (config.project_id !== projectId) throw new Error("Unexpected local project identifier.");
  for (const [actual, expected] of [[config.api?.port, 55321], [config.db?.port, 55322], [config.db?.shadow_port, 55320], [config.studio?.port, 55323], [config.local_smtp?.port, 55324]]) {
    if (actual !== expected) throw new Error(`Expected isolated local port ${expected}.`);
  }
  if (JSON.stringify(config.api?.schemas) !== '["public"]') throw new Error("Expose only the public application schema.");
  if (config.api?.auto_expose_new_tables !== false) throw new Error("Automatic Data API grants must be disabled.");
  if (config.db?.major_version !== 17) throw new Error("This migration baseline targets Postgres 17.");
  return config;
}

export function loadConfig() {
  return validateConfig(parse(readFileSync(join(root, "supabase/config.toml"), "utf8")), existsSync(join(root, "supabase/.temp/project-ref")));
}

export function commandFor(action, extras = []) {
  if (extras.length) throw new Error("Extra arguments are not accepted: local scripts cannot target remote databases.");
  const commands = {
    start: ["start", "--exclude", excludedServices, "--network-id", networkId],
    "start-core": ["start", "--exclude", `${excludedServices},studio`, "--network-id", networkId],
    stop: ["stop", "--project-id", projectId],
    reset: ["db", "reset", "--local", "--yes"],
    test: ["test", "db", "--local", "supabase/tests/database"],
    lint: ["db", "lint", "--local", "--schema", "public,private", "--level", "warning", "--fail-on", "warning"],
    types: ["gen", "types", "--local", "--lang", "typescript", "--schema", "public"],
    "types-check": ["gen", "types", "--local", "--lang", "typescript", "--schema", "public"],
    check: [],
  };
  if (!Object.hasOwn(commands, action)) throw new Error("Unknown local operation.");
  return [...commands[action], "--workdir", root];
}

export function localEnvironment(env) {
  // Local commands never inherit hosted credentials or project-selection variables.
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith("SUPABASE_") && !["DATABASE_URL", "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE"].includes(key)));
}

export function validateBindings(containers) {
  if (!containers.length) throw new Error("No reference containers found after startup.");
  for (const container of containers) {
    if (!container.Name?.startsWith("/supabase_") || !container.Name.endsWith(`_${projectId}`)) throw new Error("Unexpected container outside this reference project.");
    if (!Object.hasOwn(container.NetworkSettings?.Networks ?? {}, networkId)) throw new Error("Reference container is on an unexpected network.");
    for (const bindings of Object.values(container.NetworkSettings?.Ports ?? {})) {
      for (const binding of bindings ?? []) {
        if (binding.HostIp !== "127.0.0.1" && binding.HostIp !== "::1") throw new Error(`${container.Name}: port ${binding.HostPort} bound to ${binding.HostIp || "all interfaces"}; reference ports must bind only to loopback.`);
      }
    }
  }
}
