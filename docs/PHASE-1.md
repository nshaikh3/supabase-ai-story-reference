# Phase 1 execution record

Status: Phase 1 complete. Local acceptance checks passed; Phase 2 has not started.

## Approved scope

Selectively reuse generic code from the existing web app in a separate reference repository; configure local Supabase and MCP; implement schema, migrations, synthetic seed data, generated types, and database tests. Complete owner-access policies and Auth UI are Phase 2.

## Environment

macOS ARM64, Node 24.13.0, npm 11.6.2, Supabase CLI 2.118.0. Docker responds via CLI; its existing `3d-toys-app` stack is untouched. Host memory is 8 GiB and Docker allocation about 3.8 GiB. A reduced service set and separate ports are used.

## Required checks

- Fresh database reset and seeded data.
- Database constraints, grants, and RLS tests.
- Database lint.
- Generated types and repeat generation comparison.
- Local target guard tests.
- Typecheck, ESLint, production build, and page smoke check.
- Second reset and repeat database tests for reproducibility.
- Local MCP endpoint handshake and tool discovery; desktop activation reported separately.

## Verified results

Executed on 2026-09-27 and completed on 2026-09-28 UTC (2026-09-27 in Toronto):

- 28 local-target, port-binding, and Docker-adapter tests passed with Vitest 4.1.11.
- Two fresh database resets followed by all 135 pgTAP assertions passed across four files: schema, constraints, synthetic seed, and grants/RLS denial for anonymous, Alice, and Bob identities.
- Database lint reported no schema errors in `public` or `private` on both runs.
- Database types were generated from the real local database. A fresh generation after the second reset matched the checked-in artifact after deterministic formatting.
- Final TypeScript and ESLint checks passed, including the generated types and local tooling.
- Production build passed with Next.js 16.3.6 and Webpack. Turbopack's CSS worker could not bind a port in the agent environment; see ADR-007.
- Production page served at `http://127.0.0.1:3100`; desktop browser inspection and the architecture navigation link passed. No browser console warnings or errors were captured.
- All nine reused files matched the recorded source and destination hashes.
- npm reported zero known vulnerabilities after updating Vitest from 4.1.10 to 4.1.11.
- First Supabase image pulls stalled in Docker's credential helper. An isolated anonymous Docker configuration allowed downloads to proceed. The initial ten-minute wrapper timeout expired during downloads; the startup timeout is now thirty minutes, with other operations bounded at ten minutes.
- The full reference stack passed its mandatory health checks, including Studio. The project-scoped Docker adapter makes host bindings explicit and gives Studio a ten-second probe deadline with a thirty-second startup grace period. No other project's containers were stopped.
- Runtime inspection verified the reference services use the intended network and publish only to loopback. A prior failed binding check stopped the reference containers instead of accepting all-interface bindings.
- The MCP endpoint at `http://127.0.0.1:55321/mcp` completed initialization with protocol `2025-06-18`, identified Supabase server `0.12.0`, and listed 11 tools. No mutating MCP tool was invoked.

## Remaining boundaries

- Codex desktop may need a reload of this trusted project to activate its checked-in MCP configuration. Endpoint verification does not prove the current desktop session has loaded the tools.
- Hosted CI and deployment have not been run; no remote repository or hosted project was connected.
- Human review of security-sensitive code remains pending. Phase 1 verifies data integrity and denied access, not owner-authorized application operations.
- The CLI 2.118.0 compatibility adapter must be reviewed when upgrading the CLI. See the documented reproduction and removal conditions in contribution notes and ADR-008.

## Phase 2

Add Supabase Auth and session handling, reviewed owner policies and explicit grants, protected application routes, and automated allowed/denied cross-user tests. Constrain writable columns, prevent ownership transfer and forged generation status, and verify that pages and assets authorize through the parent story. Keep Storage, generation workers, and Realtime changes in their later phases.
