import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// A separate app directory prevents private routes, Actions and middleware from
// entering this deployment. No environment selection can turn it into the app.
const root = fileURLToPath(new URL("../", import.meta.url));
const project = join(root, "showcase");
if (process.argv.length !== 2) throw new Error("Showcase build accepts no arguments.");
if (readdirSync(project).some(name => name.startsWith(".env"))) throw new Error("Showcase must not contain environment files.");
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "CI", "SYSTEMROOT"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
env.NEXT_TELEMETRY_DISABLED = "1";
env.NODE_ENV = "production";
const result = spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build", project, "--webpack"], { cwd: root, env, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

const appPaths = Object.keys(JSON.parse(readFileSync(join(project, ".next/server/app-paths-manifest.json"), "utf8")));
const allowed = new Set(["/page", "/demo/page", "/architecture/page", "/_not-found/page", "/_global-error/page"]);
if (appPaths.some(path => !allowed.has(path)) || !["/page", "/demo/page", "/architecture/page"].every(path => appPaths.includes(path))) throw new Error("Unexpected showcase route inventory.");
const actions = JSON.parse(readFileSync(join(project, ".next/server/server-reference-manifest.json"), "utf8"));
if (Object.keys(actions.node ?? {}).length || Object.keys(actions.edge ?? {}).length) throw new Error("Showcase must not contain Server Actions.");
const files = readdirSync(join(project, "out"), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile());
const scripts = new Set();
const styles = new Set();
for (const file of files) {
  const path = join(file.parentPath, file.name);
  if (/\.(?:html|js|txt|json|css)$/.test(file.name)) {
    const content = readFileSync(path, "utf8");
    if (/sb_(?:publishable|secret)_|https?:\/\/[^\s"'<>]+\.supabase\.co|127\.0\.0\.1:55321|GENERATION_WORKER_SECRET/.test(content)) throw new Error("Backend configuration found in showcase output.");
    if (file.name.endsWith(".html")) {
      for (const [tag, hashes] of [["script", scripts], ["style", styles]]) {
        for (const match of content.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi"))) {
          if (!/\bsrc\s*=/i.test(match[1]) && match[2]) hashes.add(`'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`);
        }
      }
    }
  }
}
const csp = ["default-src 'none'", `script-src 'self' ${[...scripts].join(" ")}`, `style-src 'self' ${[...styles].join(" ")}`, "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'none'"].join("; ");
const headers = {
  "Content-Security-Policy": csp,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=31536000",
};
const output = join(root, ".vercel/output");
// Replace only generated Build Output; preserve any separately reviewed project link.
if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });
cpSync(join(project, "out"), join(output, "static"), { recursive: true });
writeFileSync(join(output, "config.json"), JSON.stringify({ version: 3, routes: [
  { src: "^/(.*)$", headers, continue: true },
  { src: "^/(.*)$", methods: ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"], status: 405 },
  { src: "^/$", dest: "/index.html" },
  { src: "^/demo/?$", dest: "/demo/index.html" },
  { src: "^/architecture/?$", dest: "/architecture/index.html" },
  { handle: "filesystem" },
  { src: "^/(.*)$", dest: "/404.html", status: 404 },
] }, null, 2) + "\n");
console.log(`Showcase verified: three public routes, zero Server Actions, ${files.length} static files; CSP hashes generated from the built HTML. No backend environment is used.`);
