import { projectId } from "./local-config.mjs";

const localPorts = new Set([55320, 55321, 55322, 55323, 55324, 55327, 55328, 55329]);

// Adapt only this project's CLI-created services. Never alter global Docker settings.
export function referenceDockerArgs(input) {
  const args = [...input];
  if (args[0] !== "create") return args;
  const nameIndex = args.indexOf("--name");
  const name = nameIndex < 0 ? "" : args[nameIndex + 1];
  if (!name?.startsWith("supabase_") || !name.endsWith(`_${projectId}`)) return args;
  if (args.includes("--no-healthcheck")) throw new Error("Reference health checks cannot be disabled.");

  for (let i = 1; i < args.length; i++) {
    if (args[i] !== "-p") continue;
    const match = /^(?:127\.0\.0\.1:)?(\d+):(\d+)(\/(?:tcp|udp))?$/.exec(args[i + 1] ?? "");
    if (!match || !localPorts.has(Number(match[1]))) throw new Error("Unexpected reference port mapping.");
    args[i + 1] = `127.0.0.1:${match[1]}:${match[2]}${match[3] ?? ""}`;
    i++;
  }
  if (name === `supabase_studio_${projectId}`) {
    const timeout = args.indexOf("--health-timeout");
    if (timeout < 0 || args.indexOf("--health-cmd") < 0) throw new Error("Studio health-check arguments changed; review the CLI adapter.");
    args[timeout + 1] = "10s";
    const grace = args.indexOf("--health-start-period");
    if (grace >= 0) args[grace + 1] = "30s";
    else args.splice(1, 0, "--health-start-period", "30s");
  }
  return args;
}
