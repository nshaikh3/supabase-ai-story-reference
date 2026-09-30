# Phase 4 execution record

Status: Phase 4 complete locally. Required acceptance checks passed on 2026-09-30. Phase 5 has not started.

## Scope and implementation

The existing reference app now includes owner-readable generation jobs, an authenticated `generate-story` Edge Function, deterministic mock generation, an optional Gemini adapter, output validation, safe failures, retries and the generation UI. Existing Auth, story and private Storage workflows are retained. No additional commercial source, credentials or project services were used.

The CLI-created fifth migration adds job history, explicit grants and owner RLS. Enqueue locks the story, admits one active job, reuses duplicate requests, expires interrupted two-minute leases and limits each story to three attempts. Claim and finish require both the caller's JWT identity and a random Edge-only worker secret. Postgres stores only its SHA-256 hash in an unexposed, RLS-protected table. Application and Edge clients use public keys and the caller's JWT; no service-role client is introduced. Only claim/finish requests receive the worker header.

Exposed RPCs are invokers delegating to narrow private definer functions with empty search paths, explicit owner checks and restricted execute privileges. Validation, all five page writes and both completion states form one transaction. Late, duplicate and expired results cannot overwrite success or another attempt. Deleting a story cascades its jobs; an in-flight provider may finish computing but cannot publish into a deleted story. Inputs are locked while queued/generating and after completion; failed inputs remain editable.

Generation uses bounded request/response execution with explicit lease recovery. The action enqueues before calling Edge and revalidates the UI, including stale tabs whose story completed elsewhere or exhausted its attempts. There is no durable background queue, automatic polling or automatic paid retry. Manual refresh and resume handle interruptions until Phase 5 adds live events.

The mock creates five repeatable pages, approximately 40–80 words each, without external calls. Optional Gemini uses a fixed HTTPS host, explicit model configuration, a header API key, a 30-second deadline, bounded response bytes and structured JSON. No tools or images are sent. Output is revalidated before persistence and rendered as escaped text. The saved user title is retained. Arbitrary provider/database errors never enter the UI or stored job metadata.

## Verification

- Final `npm run check`: 158 Vitest tests across 15 files, TypeScript, ESLint and production Webpack build passed.
- Two fresh resets with the corrected final schema applied all five migrations. All 269 pgTAP assertions across six files passed after each reset. Coverage includes real-role owner isolation, direct-write denial, worker authorization, atomic completion, malformed output, duplicate claims, expiration/retries, attempt limits, input locks and deletion during generation.
- Database lint found no schema errors. Generated public database types matched after both resets.
- Local advisors reported zero errors and one expected INFO: the private worker-key table has RLS with no client policies. This intentional deny-all boundary is retained.
- All five Playwright scenarios passed in local Google Chrome (3.9 minutes): Auth regressions, real Edge authentication and ownership, simultaneous generation requests, five-page UI/persistence, and private Storage regression coverage.
- The generation scenario passed again against the final build (1.7 minutes), including stale-tab refresh after another tab completed the story.
- Desktop and 390-pixel mobile generation screenshots were visually reviewed; the browser assertion found no horizontal overflow.
- Production npm dependency audit found zero known vulnerabilities. Credential-pattern and Git whitespace checks were clean; local documentation links resolve.
- Reuse provenance remains recorded: eight generic files unchanged and one documented TypeScript configuration adaptation for Deno import extensions. No commercial source was modified.

The browser suite removed its synthetic image bytes through Storage before the final reset. The final reset removed synthetic login accounts and restored seed fixtures. Edge secrets and public app configuration remain ignored and mode 0600. Temporary CLI logs were removed after diagnosis. Core mode now runs seven reference services, including Edge Runtime, with startup health checks and loopback/network validation. Studio/MCP remain off in core mode.

## Resolved failures and review findings

The first database run caught an invalid PL/pgSQL local-variable qualification in completion and a timestamp fixture editing a now-locked completed story. The function and fixture were corrected, and the fresh-reset suite passed. Early application type checks required regenerated database types and a non-null validated publishable key in the browser fixture.

Two Docker readiness attempts exceeded the original 20-second deadline. A read-only measurement completed in 25 seconds while the host used about 11.3 GiB of swap. Only `docker info` now receives a bounded 60-second readiness deadline; container probes and target guards remain required. The reference-only restart succeeded. No other project's containers or volumes were stopped, reset or removed.

Review also caught a stale-tab UI case when enqueue returned no job after completion or the attempt cap. The action now refreshes those committed states, with unit and real browser coverage. No required local check remains failing.

## Security and remaining boundaries

JWT verification, parent-owner RLS, explicit grants, narrow worker capabilities, private definer scope, transaction/lease races, secret isolation, escaped output, provider time/byte limits and safe error metadata were reviewed in code and tests. See SECURITY.md and ADR-014–016 for the authorization boundary and tradeoffs.

Live Gemini was not called; it is optional and needs a separately supplied key/model only if desired. Mock mode needs no paid key or user setup beyond a local account. Hosted CI and deployment were not executed. Human security review, global quotas/rate limits, production Storage reconciliation, provider/content safety evaluation and hosted secret provisioning/rotation remain predeployment work. Structural output validation does not guarantee content suitability. No public production-readiness claim is made.

## Documentation

README, architecture, database, security, decisions, AI development, contribution notes, the reuse manifest, AGENTS.md and this phase record were updated. Earlier phase records remain historical.

## Next phase

Phase 5 should add private Realtime Broadcast for job/status changes, owner-authorized story channels and reconnect reconciliation against current RLS-protected database state. Keep payloads minimal, test cross-owner subscription denial and session changes, and replace manual refresh with live updates without frequent polling.

## Reference material

Implementation was checked against official [Edge authorization headers](https://supabase.com/docs/guides/functions/auth-headers), [Edge secrets](https://supabase.com/docs/guides/functions/secrets), [function dependencies](https://supabase.com/docs/guides/functions/dependencies), [Gemini generateContent](https://ai.google.dev/api/generate-content), and [structured output](https://ai.google.dev/gemini-api/docs/structured-output) documentation, plus the installed Next.js Server Actions guide. Exact CLI/SDK versions remain pinned in the project.
