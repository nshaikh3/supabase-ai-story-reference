import { describe, expect, it } from "vitest";
import { expectedRows, parsePerformanceOutput } from "../scripts/performance-report.mjs";

function fixture() {
  const baseline = { kind: "baseline", counts: [2, 3, 3, 0, 0] };
  const context = { kind: "context", role: "authenticated", bypassRls: false, rowSecurity: "on", sequentialScans: "on", visibleStories: 5000, visiblePages: 25000, visibleAssets: 5000, visibleJobs: 5000 };
  const cleanup = { kind: "cleanup", counts: baseline.counts, fixtureUsers: 0 };
  const plans = Object.entries(expectedRows).map(([name, rows]) => ({ kind: "plan", name, explain: [{ "Execution Time": 1, "Planning Time": 0.5, Plan: { "Node Type": "Index Scan", "Actual Rows": rows, "Actual Loops": 1, "Shared Hit Blocks": 2, "Shared Read Blocks": 0, "Index Name": "synthetic_index" } }] }));
  const output = () => [baseline, context, ...plans, cleanup].map(row => JSON.stringify(row)).join("\n");
  return { baseline, context, cleanup, plans, output };
}
describe("performance evidence integrity", () => {
  it("retains measured nodes, timings and buffer counts only after validation", () => {
    const report = parsePerformanceOutput(fixture().output());
    expect(report.cleanupVerified).toBe(true); expect(report.queries).toHaveLength(11);
    expect(report.queries[0]).toMatchObject({ name: "dashboard_first", rows: 21, executionMs: 1, sharedHits: 2, sharedReads: 0, nodes: [{ type: "Index Scan", index: "synthetic_index", rows: 21, loops: 1 }] });
  });
  it.each(["role", "rowSecurity", "sequentialScans"] as const)("rejects an invalid %s context", field => {
    const f = fixture(); f.context[field] = "invalid";
    expect(() => parsePerformanceOutput(f.output())).toThrow("authenticated RLS");
  });
  it("rejects bypass-RLS execution", () => {
    const f = fixture(); f.context.bypassRls = true;
    expect(() => parsePerformanceOutput(f.output())).toThrow("authenticated RLS");
  });
  it("rejects unexpected fixture visibility", () => {
    const f = fixture(); f.context.visibleStories = 10000;
    expect(() => parsePerformanceOutput(f.output())).toThrow("visibility");
  });
  it.each(["counts", "users"])("requires proven fixture cleanup (%s)", failure => {
    const f = fixture(); if (failure === "counts") f.cleanup.counts = [2, 10003, 3, 0, 0]; else f.cleanup.fixtureUsers = 2;
    expect(() => parsePerformanceOutput(f.output())).toThrow("rollback");
  });
  it.each(["missing", "duplicate"])("rejects %s plans", failure => {
    const f = fixture(); if (failure === "missing") f.plans.pop(); else f.plans[1] = f.plans[0];
    expect(() => parsePerformanceOutput(f.output())).toThrow("Missing or duplicated");
  });
  it("rejects other-owner visibility even if all plans ran", () => {
    const f = fixture(); f.plans.find(p => p.name === "other_owner_pages")!.explain[0].Plan["Actual Rows"] = 5;
    expect(() => parsePerformanceOutput(f.output())).toThrow("Unexpected performance query");
  });
});
