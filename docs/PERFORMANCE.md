# Postgres/RLS performance review

## Reproduce

Start the isolated reference stack, apply its migrations with `npm run db:reset`, then run `npm run db:performance`. No additional arguments are accepted. The wrapper rejects hosted links and nonlocal Docker, validates the exact reference container's bindings, and runs only the checked-in workload. It cannot accept arbitrary SQL, file paths, container names or connection strings.

The workload adds two fictional identities, 10,000 stories, 50,000 pages, 10,000 image reservations (no byte objects) and 10,000 completed mock jobs inside one transaction. All existing policies, grants and triggers remain enabled. It analyzes the fixture tables, switches to `authenticated`, enables RLS and measures SELECT statements with EXPLAIN ANALYZE/BUFFERS. Role/visibility assertions reject privileged measurements or unexpected cross-owner rows. The transaction rolls back; table counts and absence of fixture identities are checked, and baseline planner statistics are refreshed. Fixed statement/lock/idle and process deadlines bound execution. A failure closes the connection and rolls back; run `db:reset` before retrying if cleanup verification did not finish. Concurrent user work or browser tests should not run alongside the workload.

The command writes full plans to ignored `test-results/database-performance.json`. Playwright clears that directory when it starts. The reviewed synthetic snapshot is preserved in [phase6-performance.json](evidence/phase6-performance.json), including the workload's SHA-256. There are no real identities, prompts, image bytes, tokens or keys in this evidence. Aborted bulk inserts can leave physical dead space even after rollback; the final reference reset removes it. Do not run this workload against a real-data service.

## Measured results — October 5, 2026

PostgreSQL 17.6, local Docker on the development laptop. The measured owner sees exactly 5,000 stories/assets/jobs and 25,000 pages; the second owner's half remains invisible. Normal planner settings, including sequential scans, remain enabled. Timings below are individual warm local samples, not medians, CI latency thresholds or production capacity claims. All measured buffers were cache hits; no shared disk reads occurred.

| Query | Rows | Execution ms | Shared buffer hits | Observed path |
| --- | ---: | ---: | ---: | --- |
| Dashboard first page | 21 | 0.151 | 4 | Owner/created/id composite index |
| Dashboard offset 4,900 | 21 | 5.539 | 223 | Sequential scan of 10,003 stories; 5,000 owner rows sorted |
| Equivalent keyset comparison | 21 | 0.221 | 5 | Existing owner/created/id composite index |
| Story detail | 1 | 0.096 | 3 | Story primary key |
| Five story pages | 5 | 0.266 | 23 | Story/page unique index; parent primary-key RLS lookups |
| Hero metadata | 1 | 0.718 | 6 | Partial unique hero/story index; parent lookup |
| Exact Storage metadata path | 1 | 0.397 | 7 | Unique path index; parent lookup |
| Job history | 1 | 0.221 | 6 | Story/created/id job index; parent lookup |
| Other owner's pages | 0 | 1.314 | 23 | Indexed candidates rejected by parent ownership |
| Realtime owner probe | 1 | 3.464 | 14 | Managed partition indexes and story primary key |
| Realtime other-owner probe | 0 | 0.201 | 3 | Owner check fails before message access |

No index or RLS migration was justified for the current application queries. First-page and selective reads use existing indexes. Child ownership checks remain correlated to their parent, but are bounded by the indexed story filter (five page lookups in this fixture). Auth/topic values appear as one-time InitPlans. The Realtime owner lookup runs once, and the other-owner probe returns zero rows.

Deep offset pagination remains linear work: the planner chose to scan/sort a large owner fraction rather than walk thousands of index entries. The dashboard currently permits up to page 10,000. Before supporting large libraries, change to stable cursor pagination using `(created_at, id)` with the existing index; add navigation and mutation-between-page tests then. The keyset query is only a measured comparison and is not implemented in the UI.

The first exploratory Realtime query filtered messages by topic and scanned partitions. Source inspection of the installed Realtime v2.135.3 established that the real authorization check reads its generated probe IDs. The final workload and snapshot use that actual query shape; the earlier broad topic measurement is not reported as channel-join performance. Managed Realtime indexes were not modified.

This does not measure network/SSR/Storage transform cost, provider latency, cold cache, many simultaneous users, connection pooling, realistic skew across many tenants, hosted hardware, or full channel-join latency. The job-history fixture has one completed job per story; lifecycle tests separately cover the three-attempt bound. A new runtime version or workload distribution requires a fresh measurement.

## References

- [Official Supabase Postgres skills](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices): RLS InitPlans, composite indexes and EXPLAIN guidance.
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
- [Pinned Realtime authorization source](https://github.com/supabase/realtime/blob/v2.135.3/lib/realtime/tenants/authorization.ex)

## October 6 runtime and hardening follow-up

The [Postgres 17.11 snapshot](evidence/hardening-performance.json) reruns the same 11 authenticated query shapes after the supported CLI upgrade and resource migration. Row visibility and rollback checks passed. The laptop was also compiling the application during this sample; do not compare its elapsed timings to the isolated Phase 6 sample as a latency regression benchmark. Existing indexed selective queries remain bounded; deep offset still performs more work.

The application now limits each owner to 50 stored stories. The privileged synthetic workload intentionally exceeds that capacity to review query plans; every measured SELECT still runs as `authenticated` under RLS. Cursor pagination remains an optional change if the product later raises its library limit, rather than a missing feature for the current bounded reference.
