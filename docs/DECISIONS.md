# Decisions

## ADR-001: Selective reuse in a separate repository

The user revised the original clean-room requirement to authorize reuse of generic existing code. We extracted reviewed UI primitives and configuration from current working files; hashes record provenance. The commercial repository and its uncommitted work remain unchanged. Product-specific behavior, assets, history, secrets, and prompts are excluded. This preserves useful work without publishing unrelated commercial code.

## ADR-002: RLS enabled before access

Phase 1 explicitly denies all client access. Phase 2 introduces allowed operations and tests together. This makes the schema safe during incremental development and keeps the security boundary inspectable.

## ADR-003: Parent-derived ownership

Only stories carry an owner. Pages and assets inherit authorization through their story. This avoids contradictory ownership fields and demonstrates relational authorization.

## ADR-004: Imperative migrations

Reviewed SQL migrations are authoritative. No production schema pull is needed. CLI-generated filenames and fresh resets establish order and reproducibility. Text plus CHECK constraints keep evolving status values straightforward; lifecycle transitions will be a separate concern.

## ADR-005: Isolated local stack

Use project ID `supabase-ai-story-reference`, app port 3100, Supabase ports 55320–55324, and a loopback network. The existing stack is left running. Omit services unnecessary for Phase 1 while retaining Studio/metadata for MCP. Health checks remain mandatory.

## ADR-006: Adapt the existing frontend foundation

Keep the source app's `src/` organization and generic UI components, TypeScript, ESLint, PostCSS, and Vitest approach. Install only necessary packages, pin versions, and use system fonts so builds do not need a font download. Framework security updates are independent from copying a product's entire dependency graph.

## ADR-007: Webpack for this constrained local environment

The installed Next.js CLI supports `--webpack` for development and production builds. Turbopack failed when its CSS worker tried to bind a local port under the agent's environment, including after an approved retry. Use Webpack consistently in the package scripts. This is a build-environment choice, independent of the database design.

## ADR-008: Project-scoped Docker compatibility adapter

The documented custom-network recipe did not yield loopback-only published ports with CLI 2.118.0 and Docker Desktop 29.6.2 on this host. Studio also exceeded the CLI's hardcoded two-second health deadline during cold starts. Global Docker configuration and other projects remain unchanged.

The local wrapper resolves the real Docker executable, then puts a repository-local adapter on the CLI subprocess's PATH. It modifies only `docker create` calls for this project's named services: allowed published ports gain an explicit `127.0.0.1` address, and Studio retains its actual health probe with a ten-second deadline and thirty-second startup grace period. Secret environment values are not added to arguments or logs. Other commands and projects pass through unchanged.

Actual bindings are checked after startup and failures stop the reference containers. Unit tests cover port restrictions, project scope, and retention of the health probe. This is a compatibility measure tied to the pinned CLI, not a general container orchestrator. Review or remove it when upstream settings can express these requirements directly. Core mode omits Studio and postgres-meta when MCP is unnecessary. Phase 3 adds a bounded five-minute wait after starting this project’s Storage container, because the pinned CLI’s final health retry budget can expire during cold Node startup on a swapping host. The adapter accepts only the actual healthy probe status, fails on stopped/OOM/missing-probe services, supports cancellation and leaves other Docker commands/projects untouched. The CLI still performs its own final health checks. The pinned type generator introspects Postgres in-process and needs no running metadata service.

Phase 4 local readiness follow-up: a measured `docker info` call completed in 25 seconds while the host was using about 11.3 GiB of swap. Its bounded readiness deadline is now 60 seconds (other short Docker operations remain at 20 seconds); no health probe or target guard is bypassed.

## ADR-009: Server-rendered Auth with fixed local redirects

Use pinned Supabase SSR and JavaScript SDKs with a per-request server client and Next.js Server Actions. PKCE email confirmation and recovery return to one fixed callback and require the initiating browser. Proxy refreshes cookies and verifies claims; the protected data boundary independently calls Auth getUser. Auth responses are dynamic and never shared-cacheable. Current-session sign-out avoids invalidating sessions on other devices. Deployment configuration, Secure cookies, SMTP and CAPTCHA require a later explicit review. No commercial environment or hosted key is reused.

## ADR-010: Owner policies plus column privileges

Six separate policies implement owner SELECT/INSERT/UPDATE/DELETE on stories and parent-owner SELECT on pages/assets. Only title, child_name and prompt are client-writable. Ownership, status, IDs and timestamps stay database/server-managed. RLS uses both USING and WITH CHECK; column privileges prevent permitted owners from forging generated state. Child writes remain closed until an actual upload or generation workflow requires them. Avoid definer functions and duplicated ownership columns.

## ADR-011: Reproducible Auth tests without privileged application credentials

Browser tests register random synthetic local users, read their own captured local mail, confirm through the actual callback and test session refresh, recovery and sign-out. No test-only bypass route or service-role client is added to the app. Recordings that could retain credentials are disabled. Database tests use synthetic claims in a transaction for exhaustive role/operation coverage; browser tests complement rather than replace those assertions. Resetting the disposable reference database removes test accounts.

## ADR-012: Owner workspace and immutable private hero images

Reuse the existing generic UI primitives for the dashboard, shared story form and illustration panel. Use server rendering, Server Actions and the existing verified user client. Keep drafts editable and generated status protected; lifecycle/editing locks belong to Phase 4. Paginate owner stories with deterministic creation-time/ID ordering.

Use one private bucket with a 2 MiB byte cap and three raster MIME types. The application decodes, normalizes and strips metadata, then writes WebP at a random owner/story path with upsert disabled. The private image route revalidates bytes because direct Storage callers can spoof MIME. It avoids signed URL lifetime/revocation tradeoffs and shared image caching. Sharp is a pinned direct dependency already present in Next's dependency tree.

## ADR-013: Retain failed reservations and remove bytes before rows

Reserve immutable asset metadata before upload; one partial unique index admits one hero per story. A failed upload leaves that reservation for explicit removal and retry. Remove objects through the Storage API before deleting metadata/story rows. A narrow trigger-only definer guard prevents relational deletion while a committed object still exists, including parent cascades where invoker RLS cannot see the deleted parent. It has no client execute grants and never mutates Storage's managed schema/data.

Storage preflight authorization and completion span separate transactions (verified in the pinned Storage v1.77.0 uploader). Do not pretend a policy row lock or SQL cascade can make this atomic. Concurrent late uploads/ambiguous transport failures remain a documented production limitation; add reconciliation and fault/concurrency testing during the security audit. No privileged cleanup client is placed in this local application.

## Future decisions

Production object reconciliation/quotas and private Broadcast authorization require explicit decisions in their implementation phases. No paid AI API is needed for mock generation.

## ADR-014: Caller authorization plus a narrow worker capability

Keep the caller's JWT on every generation database request. RLS establishes owner visibility before enqueue; private lifecycle functions repeat explicit `auth.uid()`/parent ownership checks. An owner may enqueue and read jobs, but cannot publish pages or forge completion through the Data API. Claim/finish additionally require a 256-bit random `x-generation-worker` secret set by Edge code, never copied from request headers. Only a SHA-256 hash is stored in an unexposed table with RLS and no client grants. Public RPC wrappers are invokers; private definer implementations have empty search paths and no dynamic SQL. The `authenticated` role has private schema USAGE and only the three required function EXECUTEs, not table access. The worker guard itself is not directly executable by clients.

This deliberately avoids a service-role application client. The elevated SQL surface is limited to the lifecycle of a story owned by the authenticated caller. The capability is not sufficient without a valid owner JWT, and cannot grant general table writes. Local setup generates the secret in ignored `supabase/functions/.env` (0600); reset provisions its hash via the exact local reference database container. This is local provisioning, not a hosted secret-management implementation. Production must provision/rotate the capability through reviewed secret-management operations and keep request headers out of logs.

## ADR-015: One active job, bounded synchronous work and explicit recovery

Story row locks serialize enqueue/claim/finish. A partial unique index backs the one-active-job invariant. Queued/generating jobs have two-minute leases; retries replace expired jobs and reject stale writes by job ID/status/lease. Completion validates five sequential pages and commits pages plus both terminal statuses atomically. Duplicate HTTP requests reuse the current job or return the existing completed story. Three total attempts per story bound this local demo; they are not account-wide rate limits.

Use request/response Edge execution with a 30-second provider deadline rather than an unimplemented durable background queue. A lost worker or failure-reporting write leaves a recoverable lease, not a promise of automatic delivery. Manual refresh/resume supports interruption; no periodic polling is added before private Broadcast. Inputs become immutable while active and after completion. Failed inputs may change. Owner deletion cancels persistence by cascading the job; it cannot undo an external provider call already in flight.

## ADR-016: Mock first; optional Gemini behind explicit configuration

Default to deterministic mock prose with no network or paid credentials. Gemini uses the documented generateContent REST endpoint and JSON schema, with an explicit model environment variable rather than an assumed permanent model name. Only title, fictional hero name and story idea leave the app in this optional mode; images are excluded. A fixed HTTPS host, rejected redirects, header key, deadline, byte cap and repeated structural validation constrain the provider boundary. Treat output as untrusted text, keep the user's title and store only allowlisted failure metadata. Structural validation is not content moderation; this remains a reference demo requiring a safety/usage review before public use.
