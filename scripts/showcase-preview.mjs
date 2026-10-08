import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 2) throw new Error("Showcase preview accepts no arguments.");
const output = fileURLToPath(new URL("../.vercel/output/", import.meta.url));
const root = join(output, "static");
const config = JSON.parse(readFileSync(join(output, "config.json"), "utf8"));
const headers = config.routes[0].headers;
const files = new Map(readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => {
  const fullPath = join(entry.parentPath, entry.name);
  return ["/" + relative(root, fullPath).replaceAll("\\", "/"), fullPath];
}));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
createServer((req, res) => {
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(req.url, "http://127.0.0.1:3101").pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (path === "/") path = "/index.html";
  else if (/^\/(demo|architecture)\/?$/.test(path)) path = path.replace(/\/$/, "") + "/index.html";
  const file = files.get(path);
  res.writeHead(file ? 200 : 404, { "Content-Type": types[extname(file ?? "/404.html")] ?? "application/octet-stream" });
  res.end(req.method === "HEAD" ? undefined : readFileSync(file ?? files.get("/404.html")));
}).listen(3101, "127.0.0.1", () => console.log("Read-only showcase: http://127.0.0.1:3101"));
