import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { referenceDockerArgs } from "./docker-args.mjs";

const binary = process.env.STORY_REFERENCE_DOCKER_BIN;
if (!binary || !isAbsolute(binary)) throw new Error("Run Docker through the project's local Supabase scripts.");
const child = spawn(binary, referenceDockerArgs(process.argv.slice(2)), { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => {
  if (signal) process.exitCode = 1;
  else process.exitCode = code ?? 1;
});
