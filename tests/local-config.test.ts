import { describe, expect, it } from "vitest";
import { commandFor, loadConfig, localEnvironment, networkId, validateBindings, validateConfig } from "../scripts/local-config.mjs";

describe("local development boundary", () => {
  it("accepts the checked-in isolated configuration", () => expect(loadConfig().project_id).toBe("supabase-ai-story-reference"));
  it.each(["--linked", "--db-url=postgres://remote", "--project-ref=production", "--all", "--no-backup", "--workdir=/other"])('rejects forwarded flag %s', flag => {
    expect(() => commandFor("reset", [flag])).toThrow("Extra arguments");
  });
  it("rejects a linked hosted project", () => expect(() => validateConfig(loadConfig(), true)).toThrow("linked"));
  it("rejects another project's identifier", () => expect(() => validateConfig({ ...loadConfig(), project_id: "other" })).toThrow("identifier"));
  it("rejects default-stack ports", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, db: { ...config.db, port: 54322 } })).toThrow("55322");
  });
  it("does not expose the private helper schema", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, api: { ...config.api, schemas: ["public", "private"] } })).toThrow("only");
  });
  it("rejects automatic table grants", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, api: { ...config.api, auto_expose_new_tables: true } })).toThrow("grants");
  });
  it("pins resets to local and stops to this project", () => {
    expect(commandFor("reset")).toContain("--local");
    expect(commandFor("advisors")).toContain("--local");
    expect(commandFor("stop").slice(0, 3)).toEqual(["stop", "--project-id", "supabase-ai-story-reference"]);
  });
  it("keeps core startup isolated without skipping health checks", () => {
    const args = commandFor("start-core");
    expect(args[args.indexOf("--exclude") + 1].split(",")).toContain("studio");
    expect(args[args.indexOf("--exclude") + 1].split(",")).toContain("postgres-meta");
    expect(args[args.indexOf("--network-id") + 1]).toBe(networkId);
    expect(args).not.toContain("--ignore-health-check");
    expect(() => commandFor("start-core", ["--ignore-health-check"])).toThrow("Extra arguments");
  });
  it("requires bounded Storage and includes it in core startup", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, storage: { ...config.storage, enabled: false } })).toThrow("Storage");
    expect(() => validateConfig({ ...config, storage: { ...config.storage, file_size_limit: "1GiB" } })).toThrow("Storage");
    const args = commandFor("start-core");
    expect(args[args.indexOf("--exclude") + 1].split(",")).not.toContain("storage-api");
  });
  it("requires the isolated Edge runtime and gateway JWT checks", () => {
    const config = loadConfig();
    expect(() => validateConfig({ ...config, edge_runtime: { ...config.edge_runtime, enabled: false } })).toThrow("Edge");
    expect(() => validateConfig({ ...config, functions: { "generate-story": { verify_jwt: false } } })).toThrow("JWT");
    const args = commandFor("start-core");
    expect(args[args.indexOf("--exclude") + 1].split(",")).not.toContain("edge-runtime");
    expect(() => commandFor("generation-setup", ["--db-url=postgres://remote"])).toThrow("Extra arguments");
  });
  it("strips hosted credentials without losing Docker or PATH", () => {
    expect(localEnvironment({ SUPABASE_ACCESS_TOKEN: "private", SUPABASE_PROJECT_ID: "private", DATABASE_URL: "private", PGPASSWORD: "private", PATH: "/bin", DOCKER_HOST: "unix:///socket" })).toEqual({ PATH: "/bin", DOCKER_HOST: "unix:///socket" });
  });
  it("rejects arbitrary operations", () => expect(() => commandFor("push")).toThrow("Unknown"));
  const container = (ip: string) => ({ Name: "/supabase_db_supabase-ai-story-reference", NetworkSettings: { Networks: { [networkId]: {} }, Ports: { "5432/tcp": [{ HostIp: ip, HostPort: "55322" }] } } });
  it("accepts actual loopback bindings", () => expect(() => validateBindings([container("127.0.0.1")])).not.toThrow());
  it.each(["0.0.0.0", "::", ""])("rejects all-interface binding %s", ip => expect(() => validateBindings([container(ip)])).toThrow("loopback"));
  it("rejects missing or unexpected containers", () => {
    expect(() => validateBindings([])).toThrow("No reference");
    expect(() => validateBindings([{ ...container("127.0.0.1"), Name: "/supabase_db_other" }])).toThrow("outside");
    expect(() => validateBindings([{ ...container("127.0.0.1"), NetworkSettings: { Networks: {} } }])).toThrow("network");
  });
});
