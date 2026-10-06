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

## Phase 3 work

The user authorized continuing to the next phase on 2026-09-29. The agent reused the existing foundation and generic components, read the current official Supabase skills and Storage documentation, inspected installed Next.js Server Action documentation, and added owner story UI plus private uploads. The commercial application and its Docker stack were not modified.

Image validation, object authorization, cross-account denial and failure recovery were developed with tests. A source review of the pinned Storage uploader changed the cleanup design: permission preflight does not hold a transaction through byte storage. The resulting implementation deliberately records that concurrency limitation instead of claiming atomic cleanup. Human review is still needed; automated passes are not a security certification. Executed results and any remaining failures are in PHASE-3.md.

## Phase 4 work

AI assistance produced the generation migration, worker-capability boundary, mock/Gemini adapters, Edge handler, UI and tests. The implementation uses existing generic primitives and Auth/Storage foundations; no further commercial files were copied. Current official Supabase skills, Auth/Edge secrets/header docs, CLI help, PostgreSQL RLS guidance, Gemini generateContent/structured-output docs and installed Next.js Server Actions documentation were consulted.

Verification status and observed failures are recorded in PHASE-4.md. No live Gemini request, public deployment or human security sign-off should be inferred from mocked provider tests. The custom capability/RPC boundary, concurrency guarantees, real-data privacy and production abuse controls particularly need human review before deployment.
## Phase 5 work

AI assistance added the private status trigger and receive policy, cookie-compatible browser client, subscription lifecycle, cross-tab sign-out handling, and database/unit/browser coverage. No additional commercial files or dependencies were introduced. Official Supabase skills, Broadcast/authorization/SSR guidance, the installed Realtime helper definition and SDK source, and installed Next.js `useRouter` documentation informed the implementation. The four-field message shape includes the ID added by the pinned `realtime.send` function.

Automated verification status and resolved failures are recorded in PHASE-5.md. Human review is not claimed. Phase 5's final cleanup and database checks passed on October 5 after the user's Docker restart.

## Phase 6 work

The user authorized the next phase after Phase 5 closeout. Codex reviewed application, SQL, local tooling and dependency boundaries; recorded findings before fixes; contained credential-bearing startup output and private-image dependency exceptions; and added regression tests plus a fixed local-only RLS performance workload. No additional commercial source, application feature, schema migration or dependency was introduced.

Current official Supabase skills/changelog, RLS and EXPLAIN guidance, PostgreSQL security release notes, the braces advisory, installed Next.js route/error documentation and the exact Realtime v2.135.3 authorization source informed the review. The Realtime source corrected an exploratory topic-based benchmark to use actual generated probe IDs. Performance evidence uses synthetic rollback-only fixtures and explicitly distinguishes owner-role execution from administrator fixture setup.

[PHASE-6.md](PHASE-6.md), [SECURITY-AUDIT.md](SECURITY-AUDIT.md) and [PERFORMANCE.md](PERFORMANCE.md) record results and limitations. The audit does not claim human approval, complete vulnerability coverage, production readiness or clean development dependencies. No hosted deployment or upstream issue was submitted.

## Phase 7 work

The user authorized the next phase on October 5. Codex expanded the README, architecture/trust diagrams, threat model, migration inventory, decisions and deployment handoff; added a reviewer walkthrough and offline documentation check; and corrected stale landing/dashboard copy. There is no new schema, dependency, commercial reuse, hosted configuration bypass or public deployment. Vercel with a new dedicated Supabase project is a proposed target, not an approved resource purchase.

The current official Supabase skills and changelog were read again. Official deployment, Auth redirects, Edge authentication/secrets, environment-management, backup and PostgreSQL upgrade guidance informed the runbook, together with Vercel's Next.js/Node documentation. The installed Next.js deployment/environment documentation and pinned CLI help were checked for build-time variables and release command behavior. Source links appear next to the resulting guidance in [DEPLOYMENT.md](DEPLOYMENT.md).

The README image is an unchanged copy of the successful Phase 6 local Playwright artifact `test-results/phase4-generation-desktop.png`, reviewed visually for fictional content and absence of account details/credentials before retention as `docs/images/story-workspace.png` (SHA-256 `547923b91712bc29b0b97e5de7cdd114b1497e87041b8b5b889bde7f483c31a7`). It is generated by the reference application with mock prose, not copied from the commercial app. The nine commercial-source provenance entries in [REUSE-MANIFEST.json](REUSE-MANIFEST.json) remain unchanged.

[PHASE-7.md](PHASE-7.md) records fresh verification and remaining launch gates. The documentation helper checks local links/anchors and npm script names only; it does not fetch external URLs or prove deployment safety. No human security approval, live provider test or accepted upstream contribution is claimed.
