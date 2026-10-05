import { describe, expect, it, vi } from "vitest";
import { runPrivateCli } from "../scripts/private-cli.mjs";

const sensitive = 'SECRET_KEY=sb_secret_synthetic\nJWT_SECRET=synthetic-signing-secret\nS3_SECRET=synthetic-storage-secret';
describe("credential-bearing CLI output", () => {
  it("captures both streams and exposes only success status", () => {
    const run = vi.fn(() => ({ status: 0, stdout: sensitive, stderr: sensitive }));
    expect(runPrivateCli("supabase", ["start"], { stdio: "inherit", timeout: 100 }, run)).toEqual({ status: 0 });
    expect(run).toHaveBeenCalledWith("supabase", ["start"], { stdio: ["ignore", "pipe", "pipe"], timeout: 100 });
  });
  it.each([1, null])("withholds both streams on unsuccessful exit %s", status => {
    const run = vi.fn(() => ({ status, stdout: sensitive, stderr: sensitive }));
    expect(() => runPrivateCli("supabase", ["start"], {}, run)).toThrow(/^Reference startup failed \(exit (1|interrupted)\); credential-bearing CLI output was withheld\. Check reference-container health before retrying\.$/);
  });
  it.each(["ETIMEDOUT", "ENOBUFS", "ENOENT", "EACCES", sensitive])("never forwards raw spawn errors (%#)", code => {
    const run = vi.fn(() => ({ error: { code, message: sensitive }, stdout: sensitive, stderr: sensitive }));
    expect(() => runPrivateCli("supabase", [], {}, run)).toThrow(/^Reference startup failed \((ETIMEDOUT|ENOBUFS|ENOENT|EACCES|PROCESS_ERROR)\); credential-bearing CLI output was withheld\.$/);
  });
});
