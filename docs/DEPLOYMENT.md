# Deployment preparation

**Release state: local reference only; public launch blocked.** Phase 7 prepared the handoff; the subsequent [local hardening implementation](LOCAL-HARDENING.md) adds target guards, quotas, reconciliation, worker operations and a separate staging harness. No hosted project, repository, domain or deployment has been created. The target below is a proposal from the project brief: Vercel for Next.js and a new Supabase project dedicated to this reference. It never includes the commercial application's resources.

## Decisions to make before provisioning

Record the exact Vercel team/project, Supabase organization/project reference, region, staging origin, production origin, repository URL, spending ceiling and release owner. Select an SMTP sender and retain invitation-only registration for the first demonstration. Use mock generation and fictional content for the initial staging release. Paid AI, open registration and real child data each require a separate reviewed decision. Do not paste credentials into a task, issue or this document; supply them through the chosen platform's secret store when deployment is authorized.

The local workflow can be reviewed without any hosted account or paid service. A public repository URL and license must also be chosen before publishing the source. Generic reuse is recorded in [REUSE-MANIFEST.json](REUSE-MANIFEST.json); that record is provenance, not a blanket licensing grant for unrelated commercial work.

## Environment and trust boundaries

| Environment | App and data | Execution rule |
| --- | --- | --- |
| Local — implemented | `127.0.0.1:3100`, reference Supabase `127.0.0.1:55321`, synthetic identities, local mail | Existing guarded npm scripts; no hosted link or cloud credentials |
| Staging — planned | Protected Vercel deployment and a separate reference-only Supabase project/branch with synthetic data | Explicit approved project/origin; scoped deployment identity; never share production Auth, Storage, worker secret or provider keys |
| Public demo — planned | Stable HTTPS origin and dedicated reference Supabase resources | Promote a verified commit after the release criteria below pass; no automatic promotion from an arbitrary preview |

Vercel must run the full Next.js application; static export cannot provide its Server Actions, Auth callbacks or private image route. Use the Next.js preset, repository root, `npm ci`, `npm run build`, and Node 24. Vercel currently supports Node 24; the installed Next.js deployment docs also support a Node server alternative. The local `start` script intentionally binds loopback port 3100 and is not a generic self-hosted production start command. [Vercel Next.js guide](https://vercel.com/docs/frameworks/full-stack/nextjs), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Choose host limits against this application's behavior: generation can wait up to 55 seconds in its Server Action, while provider calls are bounded to 30 seconds; uploads permit a 3 MiB multipart action body with a stricter 2 MiB image limit; Sharp requires a compatible Node/native runtime. Test timeouts, proxy body limits, image decoding and WebSocket connectivity on staging. Do not assume local `oneshot` Edge behavior establishes hosted capacity or raise limits merely to hide a failure.

## Configuration ownership

These are configuration contracts, not a ready-to-deploy environment file. [config.ts](../src/lib/supabase/config.ts) accepts only the explicitly selected target from [targets.json](../deployment/targets.json). Both hosted entries remain null, so hosted builds fail closed until reviewed configuration is supplied.

| Variable / setting | Where it belongs | Browser exposure / action |
| --- | --- | --- |
| `NEXT_PUBLIC_REFERENCE_ENV` | Next.js build environment | Defaults to `local`; `staging` or `production` requires a configured exact target |
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js build environment | Public; must be the approved reference project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Next.js build environment | Public; use that project's publishable key, never a secret/service-role key |
| `NEXT_PUBLIC_APP_URL` | Next.js build environment | Public, fixed canonical HTTPS origin; determines callback destinations |
| `AI_PROVIDER` | Supabase Edge environment | Start with `mock`; Next.js does not need it |
| `GENERATION_WORKER_SECRET` | Edge secret store only | Fresh 256-bit random hex per environment; only its SHA-256 hash belongs in `private.generation_worker_key` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Edge secret store only, if later approved | Never in Next.js or browser configuration; keep absent for mock staging |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` | Injected Edge runtime variables | The handler reads the `default` publishable key and caller JWT; verify their presence without printing values |
| Deployment access token / database credential | Protected release job/operator secret store | Privileged control plane only; no application client, public fork job or browser access |
| SMTP credentials | Dedicated hosted Supabase Auth configuration | Never copy local mail settings or unrelated service credentials |

`NEXT_PUBLIC_*` values are compiled into browser assets. Build separately for staging and production; changing environment values after a build does not repair a bundle pointed at the wrong project. See the installed Next.js environment-variable guide. Supabase reserves the `SUPABASE_` prefix for its injected Edge variables; do not try to create those as custom secrets. [Edge secret reference](https://supabase.com/docs/guides/functions/secrets).

## Required work and acceptance criteria

The maintainer owns these work items; none is silently accepted by this document. Link the fixing commit and actual verification evidence when closing an item.

| Gate | Current state | What closes it |
| --- | --- | --- |
| G7-01: Approved hosted configuration | Local code implemented; hosted verification pending | Add an explicit hosted configuration path for the selected reference project and HTTPS origins, retaining the default local guards. Test rejection of HTTP, URL credentials/query/fragment, unapproved projects/origins, secret keys and forwarded-host redirects. Verify Secure cookies and no-store behavior under HTTPS. |
| G7-02: Runtime patch baseline, S6-03 | Local stack upgraded to CLI 2.119.0 / Postgres 17.11; hosted validation pending | Review the supported CLI/image upgrade path and all intervening notes, record actual image/server versions, then pass reset, SQL/type/advisor, app, browser and performance checks. Validate the hosted engine too. Never override a managed image ad hoc or reset another stack. |
| G7-03: Dependencies, S6-04 | Open: full audit reports the unpatched development glob advisory | Recheck registry/advisory at release. Apply a compatible patch when available and rerun checks. An independently reviewed, time-bounded exception must state exposure and controls if a patch remains unavailable; this phase grants no exception. Do not use an incompatible automated major downgrade. |
| G7-04: Abuse and budget, S6-05 | Local issuance/capacity/transform controls implemented; provider traffic/spend controls pending | Implement/test account-wide story/generation/storage/transform limits and service-wide spending controls. Exercise direct Data API/Storage/Edge paths and concurrent requests, not just UI restrictions. Invite-only Auth or a Vercel password does not protect a separately reachable Supabase API by itself. |
| G7-05: Storage reconciliation, S6-06 | Local dry-run/review/apply tooling and immutable path claims implemented; hosted execution pending | Implement a reference-scoped, initially dry-run cleanup process. Test late/failed uploads, minimum object age, ownership and active-work exclusions, bounded batches and operator review before deletion. All byte deletion uses Storage APIs; never delete `storage.objects` rows to remove files. |
| G7-06: Auth, content and privacy, S6-07 | Hosted signup denial and nonce CSP/security headers implemented; actual SMTP/privacy review pending | Test dedicated SMTP confirmation/recovery, exact redirects, registration/bot controls, session/logout behavior and security headers. Define permitted content, retention/deletion and incident ownership. Real-data or paid-provider use needs its own review. |
| G7-07: Worker provisioning and rotation | Local rotation verified; protected hosted material preparation implemented; actual hosted setup pending | Build a target-checked protected provisioning step: generate a new Edge secret, write only its hash through the approved migration/operator identity, and verify owner JWT plus capability succeeds while wrong/missing capability fails. Never grant application access to the key table or change its intentional deny-all RLS. |
| G7-08: Hosted verification and operations | Separate preflight/browser harness implemented; hosted execution unexecuted | Run the staging matrix below, inspect advisors/operational logs, prove backup/restore and key rotation, set alerts and budget response, and record human release review. |

The September 25 Supabase release notes describe PostgreSQL 17.11 security fixes and possible extension-specific upgrade actions. The app uses SHA-256 digest, not PGP encryption, and defines no `ltree`/`btree_gist` indexes or custom operators; inspect actual installed extensions before deciding which actions apply. This does not establish that the older image has every fix backported. [Supabase upgrade notes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

## Release sequence after those gates close

1. Select a reviewed commit and capture fresh local evidence: `npm run check`, database reset/test/lint/types/advisors, browser regression and performance report. Run both production-only and full dependency audits and record any approved exception separately. Never mark an audit as clean by hiding development findings.
2. Provision only the explicitly selected reference staging resources. Use a separate release checkout/job and an explicit project reference so the normal local checkout remains unlinked. Existing local wrappers must continue rejecting hosted targets. Protect deployment credentials from pull requests/forks and limit token scope to the selected reference project. A database password still grants its database privileges independently of a management token's scope.
3. Review migration history and a dry run before applying the seven versioned migrations in order. Do not include `supabase/seed.sql`: its Auth identities are local SQL fixtures without usable logins. Create staging accounts through actual Auth. Review the resulting grants, private bucket, functions and receive-only Realtime policy before enabling traffic. Configuration in local `config.toml` is not proof that hosted Auth/API/Realtime settings match.
4. Set exact HTTPS Auth Site URL and callback `<approved-origin>/auth/callback`, with confirmation and refresh rotation retained. Start with a stable staging origin rather than a broad preview wildcard. Test the existing PKCE `code` callback and same-browser verifier; a token-hash template is a different flow and cannot be copied in unchanged. Keep SMTP link tracking disabled if it rewrites Auth links. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
5. Provision fresh worker configuration and deploy only `generate-story`. Keep gateway JWT verification plus the handler's independent `getUser` check. Verify the actual hosted signing-key/gateway behavior with anonymous, forged and valid user tokens. A publishable API key is not a user JWT; do not fix a compatibility failure by adding an admin client or silently disabling checks. [Function authentication](https://supabase.com/docs/guides/functions/auth).
6. Configure the private `story-assets` bucket and private-only Realtime access consistently with the migrations. Test owner/other-owner/anonymous access using the hosted services. App tables remain outside the Postgres Changes publication. Global hosted settings supplement the migration policies; they do not replace them.
7. Build Next.js for the approved staging origin/project, deploy behind staging access controls, and run the matrix below. Do not attach production credentials to arbitrary previews. Choose function duration/body limits from measured behavior and validate SSR cookie refresh/cache protection.
8. Review evidence, exact production project/origin, cost and rollback plan with the release owner. Provision/promote production only when explicitly authorized. Build with production public configuration and fresh production secrets; repeat new-account, cross-owner and failure-path checks before opening registration or announcing a public URL.

Pinned CLI help was inspected for `db push`, `functions deploy` and `secrets set`. It supports explicit `--project-ref`, `db push --dry-run`, and secret files via `--env-file`. `db push` can also write configured Vault secrets before migrations; include that in the dry-run/release review and use `--skip-vault` when no Vault synchronization is intended. `--include-seed`, `--include-all`, function `--prune`, and `--no-verify-jwt` are not part of this plan. Recheck help after any CLI upgrade. No hosted command was executed, and this guide does not bypass the project's local-only wrappers.

## Staging verification matrix

The existing [Playwright configuration](../playwright.config.mts) and fixture helpers deliberately target local origins and local mail. Do not point them at hosted resources by changing a URL or bypassing a guard. The separate [staging harness](../playwright.staging.config.mts) uses exact approved targets, two synthetic invited accounts and a protected test mailbox; see [OPERATIONS.md](OPERATIONS.md). It does not use an admin Auth bypass. Keep traces/token-bearing artifacts disabled or reviewed/redacted.

| Scenario | Required evidence |
| --- | --- |
| Fresh identity | Real email confirmation, reload, login/logout and recovery on the approved HTTPS origin; verifier remains in initiating browser |
| Owner boundaries | A creates a story/image/job; B and anonymous callers cannot read/change/delete it through UI, Data API, Storage, Edge or private Broadcast |
| Generation | Mock produces five pages once; duplicate calls converge; wrong capability/forged JWT fail; expired work recovers within the attempt limit |
| Private image | Authorized normalized WebP response, private/no-store/nosniff headers, oversized/spoofed/animated input denied, cleanup after failure |
| Realtime | Private owner join succeeds, guessed/public topic never leaks status, client forge fails, second tab updates, offline catch-up and logout work |
| Platform differences | Native Sharp load, multipart limit, long request timeout, JWT signing compatibility, Secure cookies, callback redirects and WebSocket proxy behavior |
| Abuse and operations | Concurrent direct API quota tests, budget alerts, safe error logs, reconciliation dry run and restore/rotation exercises |

Retain commit, runtime versions, target identity (not credentials), test date/results and reviewer decision. A local pass cannot populate a hosted result cell.

## Rollback, recovery and incident response

Prefer backward-compatible migrations and forward fixes. Keep the last known-good app/Edge revision and migration inventory. App rollback is safe only if its code still works with the current schema and environment; it does not revert migrations. Never run local `db:reset`, seed scripts or the synthetic performance workload against staging/production to recover a release.

Before schema changes, establish and test separate database and object-byte recovery. Supabase database backups contain Storage metadata, not stored file bytes. Define an object backup/retention process and test an isolated restore that preserves policy boundaries. Agree recovery objectives and costs with the owner instead of inventing an availability promise. [Backup limitations](https://supabase.com/docs/guides/platform/backups).

For a suspected worker secret leak, pause generation through a reviewed operational control, rotate the environment-specific capability and database hash together, restart/redeploy as required, verify old capability denial, then resume. Rotation with the current single-hash design can temporarily reject in-flight completion; inspect leases and retry explicitly after expiry. Session revocation and access-JWT expiry are separate controls. For provider-key leakage, disable that provider and rotate at its source. Never publish raw headers, keys, prompts, emails or child names in incident records.

Monitor safe operation/error codes, latency, job status/expired leases, Storage cleanup failures, Auth/Realtime errors, resource use and spend. Alerts and response ownership are requirements, not installed automations. Stopping the Next.js website alone does not stop direct authenticated Supabase traffic; design and test service-level admission/kill controls as part of G7-04.

## Current release decision

**Do not publish yet.** Local implementation is tracked in [LOCAL-HARDENING.md](LOCAL-HARDENING.md). The remaining release criteria concern selected hosting, real service configuration/evidence, the upstream development advisory and independent review. Follow [OPERATIONS.md](OPERATIONS.md) for prepared tooling. [Phase 8 evaluation](MCP-EVALUATION.md) defers a user-facing MCP interface until a concrete product need exists. No hosted result is inferred from local checks.
