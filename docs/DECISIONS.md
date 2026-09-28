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

Actual bindings are checked after startup and failures stop the reference containers. Unit tests cover port restrictions, project scope, and retention of the health probe. This is a compatibility measure tied to the pinned CLI, not a general container orchestrator. Review or remove it when upstream settings can express these requirements directly. Core mode remains available to omit Studio when MCP is unnecessary.

## Future decisions

Worker authorization, atomic job transitions, retry/idempotency, private Storage cleanup, and private Broadcast authorization require explicit decisions in their implementation phases. No paid AI API is needed for the foundation or the eventual mock generation path.
