# Phase 3 execution record

Status: Phase 3 complete. All required local acceptance gates passed on 2026-09-29 UTC. Phase 4 has not started.

## Scope

The user authorized the next phase on 2026-09-29. Phase 2 was committed and clean. This phase reuses the existing Auth client, owner policies and generic components, and adds the owner dashboard, story CRUD UI, private Storage and secure hero-image uploads. The commercial app, its containers and hosted services are outside scope and unchanged.

## Implementation

- Protected, paginated dashboard; story creation, editing, reading and confirmed deletion; status and generated fields remain server-managed.
- Optional one-per-story hero illustration, with immutable metadata reservation and random owner/story path.
- Private `story-assets` bucket, 2 MiB byte limit, PNG/JPEG/WebP MIME allowlist, owner/object policies, restricted metadata grants and a narrow trigger-only deletion guard.
- Sharp pixel decoding, MIME checks, still-image restrictions, 16-megapixel input bound, resize to 1600 pixels per side, metadata stripping and WebP output.
- Authenticated uncached image route with RLS and repeated byte validation, including protection against MIME spoofing by direct API callers.
- Storage-first deletion, retained reservations on upload/cleanup failure, and explicit retry UI. Cross-service races remain documented below.
- Core Docker mode uses a bounded, cancellable Storage readiness check and now includes Storage but omits Studio, postgres-meta, Realtime, image transformation, Edge Runtime, analytics and pooling. No privileged application key is added.

## Verification

Executed results:

- 112 Vitest tests across 12 files pass.
- TypeScript, ESLint and production Webpack build pass.
- Dependency installation audit reports zero known vulnerabilities.
- Two fresh reference resets applied all four migrations. All 208 pgTAP assertions across five files passed after each reset. The final reset removed the synthetic browser-test accounts.
- Database lint and official local security/performance advisors report no issues.
- Generated database types matched the freshly rebuilt public schema after both resets.
- All four Playwright scenarios pass in local Google Chrome (3.5 minutes total): the three Auth regressions plus owner story CRUD, private upload/display, cross-account/anonymous denials, MIME/byte caps, upsert denial, direct deletion guards, malformed-byte display rejection, empty/failed reservation removal, actual byte cleanup, and pagination.
- The browser suite removed its synthetic image objects through Storage before the final reset.
- Desktop and 390-pixel mobile story layouts were visually inspected; the mobile browser assertion confirms no horizontal overflow.

No required local check remains failing. The credential-pattern scan and Git whitespace check are clean; local documentation links resolve. All nine reused files match their recorded hashes. `.env.local` remains ignored with mode 0600; build/test artifacts remain ignored. Temporary CLI startup logs were removed after diagnosis.

The final production preview serves `/` and `/sign-up` with HTTP 200 at http://127.0.0.1:3100. All six reference services are healthy/running with verified loopback bindings. Core mode keeps Studio/MCP and postgres-meta off. No user action, hosted account or paid API key is needed to complete this phase. To try the app after the reset, register a synthetic account and confirm through the local inbox as described in README.

## Resolved and observed failures

- The first migration creation attempt lacked permission for the CLI's telemetry file outside the workspace; the authorized local CLI retry created the timestamped migration.
- Initial lint found two unused action parameters; removed them.
- Two initial unit-test fixtures failed: a case-sensitive message assertion and identical animation frames optimized into one frame. The fixtures were corrected and all 104 application tests passed; eight additional readiness tests now pass too.
- Storage-enabled core startup failed health checks during three attempts. Storage eventually logged successful startup, but the CLI’s final health budget had expired. A first readiness selector matched names while the CLI starts full container IDs; the selector now verifies the actual ID’s exact project name. Core mode omits the unnecessary metadata service, and Storage gets a bounded five-minute wait for its real health probe. The final startup passed all health checks and verified loopback bindings. Other projects were not stopped.

- The first pgTAP Storage run attempted SQL object deletion in a rolled-back fixture, which the installed Storage protection trigger rejects. Tests now retain that protection and exercise actual deletions through the browser suite’s Storage API calls. No RLS or managed-table protection was weakened.

## Security and remaining boundaries

Owner RLS, explicit column grants, random paths, byte limits, decompression bounds, MIME spoofing, image metadata, XSS-safe rendering, private caching, CSRF protection and deletion failures were reviewed in code/tests. See SECURITY.md and ADR-012/013 for details.

Storage upload permission preflight and completion are separate transactions. The deletion guard sees committed objects only; concurrent late uploads or ambiguous network failures can leave objects needing reconciliation. This local reference implementation is not a distributed transaction or production cleanup system. Production reconciliation, resource quotas/rate limits, human review and the Phase 6 audit remain required. Hosted CI is configured but not yet executed. No public deployment exists.

Implementation commit: `7fecd74` (`feat: add owner story workspace and private hero images`).

## Documentation

README, architecture, database, security, decisions, AI development, contribution notes and phase records describe the new workflow and its actual boundaries. Phase 2 remains a historical record. No additional commercial source was copied.

## Next phase

Phase 4 should add generation_jobs, controlled state transitions, authenticated Edge Function execution, idempotent/retryable jobs, validated provider output and deterministic mock generation. Decide how editing/deletion interacts with active generation and how privileged worker operations are constrained. Add success/failure/cross-owner tests with those workflows. No paid AI key is needed for mock mode; Realtime remains Phase 5.
