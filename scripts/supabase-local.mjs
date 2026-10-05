import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { commandFor, loadConfig, localEnvironment, networkId, root, validateBindings } from "./local-config.mjs";
import { runPrivateCli } from "./private-cli.mjs";

const action = process.argv[2];
const starting = action === "start" || action === "start-core";

function docker(args) {
  // `docker info` took 25 seconds on the memory-constrained development host.
  // Keep a finite readiness deadline without changing container health checks.
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: args[0] === "info" ? 60000 : 20000 });
  if (result.error) throw new Error(`Docker ${args[0]} did not respond: ${result.error.message}`);
  return result;
}

function requireLocalDocker() {
  const context = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  const endpoint = process.env.DOCKER_HOST || context.stdout.trim();
  if (context.status !== 0 || !endpoint.startsWith("unix://")) throw new Error("Use a local Docker Unix socket for this reference project.");
  const health = docker(["info", "--format", "{{.ServerVersion}}"]);
  if (health.status !== 0) throw new Error(`Docker is not ready: ${health.stderr.trim()}`);
}

async function requireAvailablePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is occupied; no existing service was stopped.`)));
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

try {
  const args = commandFor(action, process.argv.slice(3));
  loadConfig();
  if (action === "check") {
    console.log("Local configuration valid: isolated project, ports, and explicit Data API grants.");
    process.exit(0);
  }
  requireLocalDocker();
  if (action === "performance") {
    const { reviewPerformance } = await import("./performance-local.mjs");
    reviewPerformance();
    process.exit(0);
  }
  const { ensureGenerationEnvironment, provisionGenerationWorker } = await import("./generation-local.mjs");
  if (action === "generation-setup") { provisionGenerationWorker(); process.exit(0); }
  if (starting) ensureGenerationEnvironment();
  if (starting) {
    // A running reference stack is handled idempotently by the CLI.
    const running = docker(["ps", "--filter", "name=^supabase_db_supabase-ai-story-reference$", "--format", "{{.Names}}"]);
    if (running.status !== 0) throw new Error(running.stderr);
    if (!running.stdout.trim()) {
      for (const port of [55320, 55321, 55322, 55323, 55324]) await requireAvailablePort(port);
    }
    let network = docker(["network", "inspect", networkId]);
    if (network.status !== 0) {
      const created = docker(["network", "create", "--driver", "bridge", "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", networkId]);
      if (created.status !== 0) throw new Error(created.stderr);
      network = docker(["network", "inspect", networkId]);
    }
    if (JSON.parse(network.stdout)[0]?.Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1") throw new Error("Reference network must bind published ports to loopback.");
  }
  const generating = action === "types" || action === "types-check";
  const environment = action === "env";
  const resolvedDocker = spawnSync("which", ["docker"], { encoding: "utf8", timeout: 5000 });
  const dockerBinary = resolvedDocker.stdout?.trim();
  if (resolvedDocker.status !== 0 || !isAbsolute(dockerBinary ?? "")) throw new Error("Cannot resolve the local Docker CLI.");
  if (starting) console.log("Starting reference services; credential-bearing CLI output is withheld. First startup may take several minutes.");
  const run = starting ? runPrivateCli : spawnSync;
  const result = run(join(root, "node_modules/.bin/supabase"), args, {
    cwd: root,
    env: {
      ...localEnvironment(process.env),
      STORY_REFERENCE_DOCKER_BIN: dockerBinary,
      STORY_REFERENCE_NODE_BIN: process.execPath,
      PATH: `${join(root, "scripts/docker-bin")}${delimiter}${process.env.PATH ?? ""}`,
    },
    encoding: "utf8",
    stdio: environment ? ["ignore", "pipe", "pipe"] : generating ? ["ignore", "pipe", "inherit"] : "inherit",
    // Initial public image downloads can exceed ten minutes on a small laptop.
    timeout: starting ? 1800000 : 600000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (environment) console.error("Cannot read local status. Start the reference stack and retry.");
    process.exit(result.status ?? 1);
  }
  if (action === "reset") provisionGenerationWorker();
  if (environment) {
    const { publicEnvironmentFromStatus } = await import("./local-env.mjs");
    const output = publicEnvironmentFromStatus(JSON.parse(result.stdout));
    const target = join(root, ".env.local");
    if (existsSync(target)) {
      if (readFileSync(target, "utf8") !== output) throw new Error("Existing .env.local differs; review it before regenerating. It was not overwritten.");
    } else {
      writeFileSync(target, output, { mode: 0o600, flag: "wx" });
    }
    console.log("Local public configuration ready in ignored .env.local; no privileged credentials written.");
  }
  if (starting) {
    const listed = docker(["ps", "--filter", "name=_supabase-ai-story-reference$", "--format", "{{.ID}}"]);
    if (listed.status !== 0) throw new Error(listed.stderr);
    const ids = listed.stdout.trim().split(/\s+/).filter(Boolean);
    const inspected = ids.length ? docker(["inspect", ...ids]) : null;
    if (inspected && inspected.status !== 0) throw new Error(inspected.stderr);
    try {
      validateBindings(inspected ? JSON.parse(inspected.stdout) : []);
    } catch (error) {
      // Stop only containers found by the exact project suffix; retain all volumes.
      if (ids.length) docker(["stop", ...ids]);
      throw error;
    }
    console.log("Verified reference services use the isolated network and loopback ports.");
  }
  if (generating) {
    const { formatDatabaseTypes } = await import("./database-types.mjs");
    const output = formatDatabaseTypes(result.stdout);
    const target = join(root, "types/database.ts");
    if (action === "types-check") {
      if (readFileSync(target, "utf8") !== output) throw new Error("Database types differ. Run npm run db:types and review the change.");
      console.log("Generated database types match.");
    } else {
      mkdirSync(join(root, "types"), { recursive: true });
      writeFileSync(`${target}.tmp`, output);
      renameSync(`${target}.tmp`, target);
      console.log("Generated types/database.ts from the local database.");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
