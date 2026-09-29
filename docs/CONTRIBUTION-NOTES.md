# Contribution notes

Record real friction without treating environment-specific failures as proven upstream bugs.

## 2026-09-27: CLI telemetry write in a restricted agent environment

- **Feature:** CLI startup / agent environment compatibility, CLI 2.118.0 on macOS ARM64.
- **Documentation:** https://supabase.com/docs/guides/local-development/cli/getting-started
- **Problem:** Even `supabase --version` and `--help` attempted to write telemetry settings under the user's home directory. The coding-agent filesystem policy denied that write.
- **Expected:** Read-only help/version output, or a concise permission error explaining the required writable location.
- **Observed:** Startup failed with a long bundled JavaScript stack and an EPERM for `~/.supabase/telemetry.json.tmp.*`.
- **Resolution:** Run the CLI with the approved filesystem access for its normal settings directory. Help/version then succeeded; no project credential was needed.
- **Potential improvement:** Document CLI writable-directory requirements and report startup filesystem errors concisely. This is an environment compatibility observation, not yet a reproduced upstream defect outside this sandbox.

## 2026-09-27: Docker Desktop credential helper stalled local startup

- **Feature:** First local image download, CLI 2.118.0 and Docker Desktop on macOS.
- **Documentation:** https://supabase.com/docs/guides/local-development/cli/getting-started and https://docs.docker.com/reference/cli/docker/
- **Problem:** Docker health checks succeeded, but the initial start produced no progress for several minutes. Its image-pull subprocesses were waiting on `docker-credential-desktop`.
- **Expected:** Public image downloads complete or report the failing dependency.
- **Observed:** Five credential-helper processes remained attached to the reference startup. The existing application containers were healthy.
- **Resolution:** Interrupt only that startup process tree. Retry with a temporary empty Docker configuration and the same explicit local Unix socket, allowing anonymous pulls of public Supabase images. Downloads then progressed. The user's saved Docker configuration and other containers were not changed.
- **Potential improvement:** A bounded credential-helper wait and a progress message would make this failure easier to diagnose. This observation does not establish a Supabase defect; the helper belongs to Docker Desktop. Full stack verification is recorded separately in the phase record.

## 2026-09-27–28: Local binding recipe and Studio health checks

- **Feature:** Local startup, CLI 2.118.0, Docker Desktop 29.6.2, macOS ARM64, 8 GiB host RAM / approximately 3.8 GiB Docker allocation.
- **Documentation:** https://supabase.com/docs/guides/local-development recommends a custom bridge with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and `supabase start --network-id <network>`.
- **Expected:** Published reference ports are loopback-only and Studio becomes healthy.
- **Observed:** The CLI used `supabase_network_supabase-ai-story-reference` despite the supplied custom network name. Precreating that actual network with the loopback option still resulted in runtime port bindings to `0.0.0.0` and `::` on this host. This is an observed compatibility failure, not a proven root-cause attribution to either project. The runtime guard rejected these bindings and stopped only the reference containers.
- **Observed separately:** Studio failed two startup attempts. Its Docker health log showed three consecutive `Health check exceeded timeout (2s)` results, with no OOM kill; the image was `arm64/linux`. The [pinned CLI source](https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/commands/start/services/studio.service.ts) hardcodes that deadline. A previously fixed [upstream health-check issue](https://github.com/supabase/cli/pull/6149) has a similar symptom but does not prove the same cause here.
- **Resolution:** A repository-local Docker adapter sets explicit loopback addresses for this project's published ports and preserves Studio's HTTP probe with a ten-second timeout and thirty-second startup grace period. The full stack became healthy. Later warm Studio probes completed in approximately 0.2–0.6 seconds. Actual ports were verified, and local MCP initialization plus discovery of 11 tools passed.
- **Reproduction/verification:** `npm run supabase:start` applies the adapter; its behavior is covered by unit tests and runtime checks. Only synthetic reference data was present during the unsuccessful attempts. No other stack, global Docker setting, or production system was modified.
- **Potential improvement:** Recheck the custom-network recipe against the native CLI on Docker Desktop, expose explicit bind-address and per-service health-timeout settings, and report the health probe's timeout reason in startup errors. Before opening an issue, reduce this to an independent minimal reproduction and check current releases. Remove the adapter once equivalent supported settings are verified.

## Type-generation compatibility note

CLI 2.118.0 emits quoted table names and unformatted TypeScript. The first wrapper guard expected an unquoted `stories:` key and correctly preserved the previous file when that check failed. The guard now accepts the actual quoted output, syntax-checks it, and applies the pinned TypeScript printer. Generation after a fresh reset matches the committed artifact. This was an application-wrapper assumption, not an upstream bug.

## Entry template

Date · feature · documentation URL · problem · expected behavior · observed behavior · resolution · potential improvement · reproduction/verification status.

No upstream issue or contribution has been submitted.

## Phase 2 observations (2026-09-28)

- The official SSR guide's `setAll` callback now receives cache headers as a second argument (SSR >=0.10.0). The implementation carries cookies into downstream requests and browser responses, and marks all Auth/account responses private/no-store. Earlier examples that omit these headers should not be copied without reviewing caching. Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client and its advanced guide. No upstream issue was identified; current guidance covers the requirement.
- The skill's monitoring/debugging URL redirects to the newer Observability section. The redirect works and is not treated as a bug. Source: https://supabase.com/docs/guides/monitoring-and-debugging.
- After laptop idle, reference-container health checks timed out even while Docker tried to start their probes. The reference-only stop initially returned `StopContainerError`; inspection showed the containers did stop. Restarting in documented core mode restored database/Auth checks without touching the other stack. This is a host/runtime observation, not evidence that Supabase's Auth implementation failed.
- The first browser-suite load treated an imported `.mjs` local guard as CommonJS. Using `.mts` for the Playwright config/spec fixed the test-runner module boundary. This is repository test setup, not a Supabase defect.
- The pinned CLI retains an `inbucket` container name and an `INBUCKET_URL` status alias, but the running local mail service is Mailpit. An initial browser-test helper used Inbucket's mailbox API and received 404. It now uses Mailpit's `/api/v1/search` with an exact recipient filter and `/api/v1/message/{ID}`. The official password-auth guide already documents Mailpit; no upstream bug is claimed. Sources: https://supabase.com/docs/guides/auth/passwords and https://mailpit.axllent.org/docs/api-v1/.

## Phase 3 observations (2026-09-29)

- Storage policies authorize operations, but they do not form a cross-service transaction with application metadata. Inspecting the [pinned v1.77.0 uploader](https://github.com/supabase/storage/blob/v1.77.0/src/storage/uploader.ts) confirmed permission preflight before byte upload and privileged completion afterward. A proposed policy row lock would therefore not prevent all deletion races. This is an application design constraint, not an upstream bug claim. See ADR-013 and the documented reconciliation work before production.
- The first Storage-enabled core startup downloaded `storage-api:v1.77.0`, then reported Storage and postgres-meta unhealthy while the host was also building the app. The CLI removed its reference containers after the failed start. This is a local resource/startup observation; it does not establish a Storage authorization defect. Health checks were not bypassed, and other stacks remained untouched. Final recovery status belongs in the Phase 3 execution record.

- On retry, postgres-meta eventually logged that it was listening, but Storage's probe still reported connection refused and the CLI rolled back startup. Host inspection showed approximately 11 GiB of swap use. The [pinned health-check implementation](https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/command-internal/db-bootstrap/health-check.ts) uses 30 retry ticks after container startup. The project adapter now waits up to five minutes for Storage's actual Docker healthy state before returning from that exact reference-container start. It does not disable or falsify probes. Core mode also excludes postgres-meta: the [pinned type generator](https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/commands/gen/types/types.generator.layer.ts) introspects the database in-process. An upstream configurable cold-start readiness budget could remove this local workaround; no upstream issue has been filed.
- The readiness wrapper initially matched a container name, while the CLI starts Docker's full container ID. Source inspection confirmed `startContainer` passes the ID. The adapter now resolves only full IDs with a read-only name inspection and waits only on an exact reference Storage match; tests cover unrelated projects, malformed operations, cancellation and deadlines. This was a repository integration assumption, not an upstream bug.
- The installed Storage schema rejects direct SQL DELETE statements via `storage.protect_delete()`, including test statements that would match no rows. The initial pgTAP fixture assumed it could simulate API removal inside a rollback. It now tests empty reservations without deleting managed rows, and real byte deletion/owner denial are covered through the Storage API. This agrees with the [documented read-only schema guidance](https://supabase.com/docs/guides/storage/schema/design); the protection was not disabled.
- Final startup with the corrected ID-scoped wait succeeded; actual loopback bindings were verified. The fresh reset applied all migrations, 208 pgTAP assertions passed, lint/advisors found no issues, generated types matched, and all four Auth/story/Storage browser scenarios passed. This resolves the local startup obstacle for this phase without altering the other stack or skipping a health check.
