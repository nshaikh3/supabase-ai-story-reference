export const expectedRows = {
  dashboard_first: 21, dashboard_offset: 21, dashboard_keyset_comparison: 21,
  story_detail: 1, story_pages: 5, story_asset: 1, asset_path: 1, job_history: 1,
  other_owner_pages: 0, realtime_probe: 1, other_owner_realtime_probe: 0,
};

export function parsePerformanceOutput(stdout) {
  const records = stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const context = records.find(r => r.kind === "context");
  if (context?.role !== "authenticated" || context.bypassRls !== false || context.rowSecurity !== "on" || context.sequentialScans !== "on") throw new Error("Performance queries must use authenticated RLS with normal planner settings.");
  if (context.visibleStories !== 5000 || context.visiblePages !== 25000 || context.visibleAssets !== 5000 || context.visibleJobs !== 5000) throw new Error("Unexpected synthetic owner visibility.");
  const baseline = records.find(r => r.kind === "baseline");
  const cleanup = records.find(r => r.kind === "cleanup");
  if (!Array.isArray(baseline?.counts) || baseline.counts.length !== 5 || cleanup?.fixtureUsers !== 0 || JSON.stringify(baseline.counts) !== JSON.stringify(cleanup.counts)) throw new Error("Performance fixture rollback was not verified.");
  const plans = records.filter(r => r.kind === "plan");
  if (plans.length !== Object.keys(expectedRows).length || new Set(plans.map(p => p.name)).size !== plans.length) throw new Error("Missing or duplicated performance plans.");
  const queries = plans.map(({ name, explain }) => {
    const entry = explain?.[0];
    if (!Object.hasOwn(expectedRows, name) || entry?.Plan?.["Actual Rows"] !== expectedRows[name] || !Number.isFinite(entry["Execution Time"])) throw new Error("Unexpected performance query result.");
    const nodes = [];
    function visit(node) {
      nodes.push({ type: node["Node Type"], relation: node["Relation Name"], index: node["Index Name"], rows: node["Actual Rows"], loops: node["Actual Loops"] });
      for (const child of node.Plans ?? []) visit(child);
    }
    visit(entry.Plan);
    return { name, rows: entry.Plan["Actual Rows"], executionMs: entry["Execution Time"], planningMs: entry["Planning Time"], sharedHits: entry.Plan["Shared Hit Blocks"], sharedReads: entry.Plan["Shared Read Blocks"], nodes, explain };
  });
  return { context, fixtureCounts: { stories: 10000, pages: 50000, assets: 10000, jobs: 10000 }, baseline: baseline.counts, cleanupVerified: true, queries };
}
