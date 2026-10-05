import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute } from "node:path";
import { referenceDockerArgs } from "./docker-args.mjs";
import { readinessContainer, waitForService } from "./docker-readiness.mjs";

const binary = process.env.STORY_REFERENCE_DOCKER_BIN;
if (!binary || !isAbsolute(binary)) throw new Error("Run Docker through the project's local Supabase scripts.");
const args = referenceDockerArgs(process.argv.slice(2));
const cancellation = new AbortController();
const child = spawn(binary, args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => { cancellation.abort(); child.kill(signal); process.exitCode = 1; });
try {
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
  process.exitCode = code;
  const exec = promisify(execFile);
  let inspectedName;
  // The pinned CLI starts by Docker's full ID, not by the requested name.
  if (code === 0 && args.length === 2 && ["start", "restart"].includes(args[0]) && /^[a-f0-9]{64}$/.test(args[1])) {
    const { stdout } = await exec(binary, ["inspect", args[1], "--format", "{{.Name}}"], { timeout: 20000, signal: cancellation.signal });
    inspectedName = stdout.trim();
  }
  const container = readinessContainer(args, inspectedName);
  if (code === 0 && container) {
    console.error(`Waiting for ${container}'s actual health probe (up to five minutes)…`);
    await waitForService(async () => {
      const { stdout } = await exec(binary, ["inspect", container, "--format", "{{json .State}}"], { timeout: 20000, signal: cancellation.signal });
      return JSON.parse(stdout);
    }, { signal: cancellation.signal });
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
