import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scripts = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).scripts;
const failures = [];
let links = 0;

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

// This repository uses ATX headings and inline Markdown links. Do not fetch
// external URLs: documentation validation is deterministic and works offline.
function prose(text) {
  let fence = "";
  return text.split(/\r?\n/).map(line => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1][0];
      else if (match[1][0] === fence) fence = "";
      return "";
    }
    return fence ? "" : line;
  }).join("\n");
}

function anchors(text) {
  const result = new Set();
  const counts = new Map();
  for (const match of prose(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    result.add(count ? `${slug}-${count}` : slug);
    counts.set(slug, count + 1);
  }
  return result;
}

const files = [resolve(root, "README.md"), resolve(root, "AGENTS.md"), ...markdownFiles(resolve(root, "docs"))];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const label = relative(root, file);
  for (const [, command] of text.matchAll(/\bnpm run ([a-z][a-z0-9:-]*)\b/g)) {
    if (!Object.hasOwn(scripts, command)) failures.push(`${label}: unknown npm script ${command}`);
  }
  for (const [, raw] of prose(text).matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const link = raw.trim().replace(/^<|>$/g, "");
    if (/^(https?:|mailto:)/i.test(link)) continue;
    const [path, fragment] = link.split("#");
    const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
    const local = relative(root, target);
    links++;
    if (local === ".." || local.startsWith(`..${sep}`) || !existsSync(target)) {
      failures.push(`${label}: missing or out-of-repository target ${link}`);
    } else if (fragment && extname(target) === ".md" && statSync(target).isFile() && !anchors(readFileSync(target, "utf8")).has(decodeURIComponent(fragment))) {
      failures.push(`${label}: missing Markdown anchor ${link}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Documentation valid: ${files.length} Markdown files, ${links} local links and documented npm scripts checked. External URLs were not fetched.`);
