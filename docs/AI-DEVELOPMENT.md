# AI-assisted development

Codex inspected the supplied brief and existing app, researched official documentation, proposed the phase plan, and implemented the approved Phase 1 extraction and foundation. The user explicitly requested reuse and later authorized proceeding despite an unresponsive Docker UI.

The user reviewed scope and reuse boundaries. A human review of the final security-sensitive implementation remains pending; this document does not claim such review has already occurred.

Agent contributions include selective extraction, dependency pinning, migration authoring, local targeting safeguards, database tests, type generation workflow, and documentation. Actual command results are recorded in `PHASE-1.md`.

Sources consulted on 2026-09-27–28 UTC:

- [Official Supabase skill](https://github.com/supabase/agent-skills/blob/main/skills/supabase/SKILL.md), metadata version 0.1.2.
- [Official Postgres skill](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/SKILL.md), metadata version 1.1.1, including schema, FK index, privileges, and RLS references.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Database tests](https://supabase.com/docs/guides/local-development/testing/overview).
- [Local development](https://supabase.com/docs/guides/local-development/cli/getting-started).
- [MCP](https://supabase.com/docs/guides/ai-tools/mcp).
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
- [Pinned CLI Studio container specification](https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/commands/start/services/studio.service.ts) and [container-create arguments](https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/command-internal/db-bootstrap/docker-create-args.ts), used to diagnose the local compatibility issues.
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), used for a non-mutating endpoint handshake and tool-discovery check.

Skill sources were read directly from the official repository, not installed as a plugin. Their `main` URLs are mutable; metadata versions describe the reviewed content, not a pinned source commit. Every later Supabase phase must recheck current guidance and applicable changelog entries.

## Phase 2

On 2026-09-28 the user authorized Auth and ownership implementation. Codex added a request-scoped Supabase SSR integration, Auth screens/actions, a PKCE callback, owner policies and column grants, database role tests, unit tests, browser tests and public-only local environment setup. The original nine reused generic files were retained; no further commercial code or configuration was copied.

Current official Supabase skills and relevant RLS/privilege references were read again before SQL changes. The installed Next.js 16.3.6 documentation was consulted for Proxy, Server Actions and data-boundary authorization. Additional primary sources:

- [SSR client and Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Password Auth and recovery](https://supabase.com/docs/guides/auth/passwords).
- [SSR caching, cookies and sign-out scopes](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
- [Column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).
- [Observability](https://supabase.com/docs/guides/observability), reached from the skill's monitoring/debugging URL.

The agent inspected grants, policies, identity verification, caching, callback destinations and secret handling, and ran official local database advisors. This is an agent review, not a claim of human security approval or a completed Phase 6 audit. `PHASE-2.md` records actual results and remaining limits. Browser-test execution was briefly blocked by account usage limits in the automatic approval system; it resumed after the user's continue instruction.
