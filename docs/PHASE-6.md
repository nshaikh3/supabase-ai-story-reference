# Phase 6 execution record

Status: implementation and local behavioral verification complete on 2026-10-05, after Phase 5's final reset and database checks passed. The security audit is complete with open findings; full dependency audit is not clean. Scope: automated regression coverage, a dedicated security audit, and measured Postgres/RLS query review. No deployment or Phase 7 work has started.

## Findings recorded before changes

1. **Local credential output (medium, fix in this phase).** `scripts/supabase-local.mjs` inherits startup stdout/stderr. The CLI's successful startup summary contains local privileged credentials, and CI invokes that same script. Capture both streams and expose only fixed, non-sensitive progress/results. Verify with synthetic credential markers on success and failure. Existing private diagnostic files have been removed; never publish raw CLI output.
2. **Private image exception boundary (low, fix in this phase).** The asset route handles returned SDK errors and image decoding errors, but thrown client/Auth/database/Storage errors escape its generic no-store response and can reach framework error logging. Extend the existing failure boundary and test ordering, content, headers and thrown failures.
3. **Database patch baseline (high before hosting, open).** Runtime `server_version` is 17.6. PostgreSQL 17.11 includes subsequent security fixes, including role-dependent cached RLS plan invalidation. Loopback isolation reduces exposure but does not patch the engine. No exploit is claimed or attempted. A compatible Supabase CLI/image upgrade and full regression run are required before deployment; do not replace its managed image ad hoc or touch other stacks.
4. **Development dependency advisory (high upstream severity, open).** `npm audit --json` reports five affected packages from one underlying advisory, GHSA-vfj7-8cjw-p6xm / CVE-2026-93687: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3`. The registry's latest braces is still 3.0.3 and the advisory lists no patched version. The suggested automatic fix downgrades the Next ESLint config across major versions; it is not applied. This is a development glob-pattern path, not a discovered request path. Do not feed untrusted patterns to tooling; recheck upstream before release.
5. **Existing deployment blockers confirmed.** Account-wide generation/upload/transform quotas, production Auth controls, content/consent/privacy evaluation, Storage orphan reconciliation, hosted Realtime settings/revocation, and human review remain unimplemented. Per-request and per-story bounds do not provide account-wide abuse protection.

## Implemented changes

- Startup captures/discards both credential-bearing CLI streams and returns only fixed process status. Actual idempotent startup passed without printing keys. No diagnostic credential file is written.
- The private image handler contains thrown dependency/byte-read errors and preserves its generic 404 and private security headers. Auth and RLS still precede Storage access and decoding.
- `npm run db:performance` validates local configuration/socket/bindings, runs one fixed synthetic SQL workload, and verifies real authenticated owner visibility plus rollback. Hosted URLs, arbitrary SQL/file paths and forwarded flags are rejected. Eleven query plans and their workload hash are preserved in [the evidence snapshot](evidence/phase6-performance.json).
- Added 37 regression cases across image responses, CLI output containment, local performance targeting and evidence validation. CI adds production dependency audit and the fixed performance run; hosted CI itself remains unexecuted.
- Recorded the dedicated [security audit](SECURITY-AUDIT.md), measured [performance review](PERFORMANCE.md), related decision and development provenance. No application feature, dependency, migration, grant, policy, index or generated type changed. No new commercial code was copied.

## Verification

- `npm run check`: passed all 219 unit tests in 19 files, TypeScript, ESLint and production build.
- `npm run test:e2e`: all six scenarios passed in 4.2 minutes with zero retries: Auth, callback/caching, recovery, generation/competing requests, Realtime and private Storage/story CRUD. This used real local services and synthetic accounts with mock generation; no paid provider ran.
- `npm run db:performance`: passed all eleven query/role/row-count checks and fixture rollback. The final measured query shape matches installed Realtime v2.135.3. Indexed selective reads were efficient; offset 4,900 required scan/sort work, and the keyset comparison used the existing index. Timings are single warm local samples, not capacity guarantees.
- `npm audit --omit=dev`: zero advisories. Full `npm audit`: five high package entries for one unpatched development advisory; this remains an open finding, not a passing check.
- Local configuration, whitespace and relative documentation links passed. All nine reused-file hashes match. Tracked-file secret-pattern scan found no matches. Browser output contains the SDK's literal secret-key prefix validator, but no actual Edge secret or worker/provider environment marker. Ignored environment files remain 0600.
- Final reference-only reset passed with all six migrations and synthetic seed data. All 299 pgTAP assertions across seven files passed again; database lint was clean and generated types matched. Advisors returned only the intentional INFO for the deny-all private worker-key table. No health check or security assertion was relaxed. Browser-created Auth accounts and performance fixture/dead-space effects were removed by this reset.
- Final runtime inspection confirmed all eight reference services running, healthy available probes and loopback bindings. Only the two seed identities, three stories and three pages remain; assets, jobs and Storage objects are empty. Temporary audit/reset files were removed. The tested production app was restarted on `127.0.0.1:3100` for local review.

## Failures and limits

The first focused unit run passed, but TypeScript rejected the new CLI test doubles because the injected function inferred every `spawnSync` overload. A narrow documented process-result interface corrected the typing; the full check then passed.

The exploratory Realtime performance query filtered all messages by topic, producing a partition scan. Inspection of the installed service's official source showed that actual authorization reads generated probe IDs. The workload was corrected and rerun; the final evidence uses the actual query shape without changing managed indexes.

Full dependency audit remains nonzero as described above. The PostgreSQL 17.6 runtime baseline is another open security finding. Neither was concealed by an automatic downgrade, unreviewed image override or relaxed checks. Browser execution emitted non-failing Next closed-stream and terminal-color diagnostics; assertions still passed and no retries were enabled.

Human review, live Gemini, hostile-load/container vulnerability assessment and hosted deployment remain unexecuted. Phase 7 has not started. It should prepare documentation and a reviewed deployment plan that resolves the patch baseline and defines abuse/privacy/cleanup controls before any public launch.

## Sources

- [PostgreSQL 17.11 release notes](https://www.postgresql.org/docs/17/release-17-11.html)
- [Supabase upgrade notes](https://supabase.com/docs/guides/platform/upgrading)
- [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Official Supabase Agent Skills](https://github.com/supabase/agent-skills), `supabase` and `supabase-postgres-best-practices`, reviewed October 5.
- [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
- Installed Next.js Route Handlers and Error Handling documentation for the pinned framework version.
