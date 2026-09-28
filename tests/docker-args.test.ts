import { describe, expect, it } from "vitest";
import { referenceDockerArgs } from "../scripts/docker-args.mjs";

describe("project-only Docker compatibility adapter", () => {
  const name = "supabase_db_supabase-ai-story-reference";
  it("makes published ports explicitly local without changing secret environment arguments", () => {
    expect(referenceDockerArgs(["create", "--name", name, "-e", "POSTGRES_PASSWORD", "-p", "55322:5432", "image"])).toEqual(["create", "--name", name, "-e", "POSTGRES_PASSWORD", "-p", "127.0.0.1:55322:5432", "image"]);
  });
  it.each(["54322:5432", "0.0.0.0:55322:5432", "invalid"])("rejects unexpected mapping %s", mapping => expect(() => referenceDockerArgs(["create", "--name", name, "-p", mapping, "image"])).toThrow("mapping"));
  it("leaves other projects and read-only commands unchanged", () => {
    for (const args of [["create", "--name", "supabase_db_other", "-p", "54322:5432", "image"], ["inspect", name]]) expect(referenceDockerArgs(args)).toEqual(args);
  });
  it("retains Studio's actual health probe with a bounded grace period and deadline", () => {
    const args = referenceDockerArgs(["create", "--name", "supabase_studio_supabase-ai-story-reference", "--health-cmd", "probe", "--health-timeout", "2s", "image"]);
    expect(args[args.indexOf("--health-cmd") + 1]).toBe("probe");
    expect(args[args.indexOf("--health-timeout") + 1]).toBe("10s");
    expect(args[args.indexOf("--health-start-period") + 1]).toBe("30s");
    expect(args.at(-1)).toBe("image");
  });
  it("rejects a disabled or missing expected health probe", () => {
    expect(() => referenceDockerArgs(["create", "--name", name, "--no-healthcheck", "image"])).toThrow("disabled");
    expect(() => referenceDockerArgs(["create", "--name", "supabase_studio_supabase-ai-story-reference", "image"])).toThrow("changed");
  });
});
