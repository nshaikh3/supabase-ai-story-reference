import { readFileSync } from "node:fs";
import { resolveBuildConfiguration } from "../src/lib/deployment-targets.ts";

try {
  if (process.argv.length !== 2) throw new Error("Build validation accepts no arguments.");
  const manifest = JSON.parse(readFileSync(new URL("../deployment/targets.json", import.meta.url), "utf8"));
  const configuration = resolveBuildConfiguration(process.env, manifest);
  console.log(`Reference build target verified: ${configuration.environment}.`);
} catch {
  console.error("Reference build refused: configure the selected target and exact public environment values. Local settings cannot be used for a Vercel deployment.");
  process.exitCode = 1;
}
