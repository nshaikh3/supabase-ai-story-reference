# Phase 6 security audit — 2026-10-05

This is an agent code/configuration review with local automated evidence. It is not independent human review, a penetration test, a container vulnerability scan, or deployment approval. The scope is the reference application only; no commercial files, projects or services were inspected for this audit.

## Findings and disposition

| ID | Severity / scope | Evidence and consequence | Disposition |
| --- | --- | --- | --- |
| S6-01 | Medium, developer/CI logs | The local wrapper inherited the Supabase startup summary, which includes privileged local keys. CI uses the same command. | Fixed: capture both streams in memory and discard them; emit fixed progress/result messages. No raw diagnostic file. Eight regression cases cover success, failed exit, timeout, buffer exhaustion and unexpected errors. Actual idempotent startup succeeded with safe output. Existing credential-bearing temporary recovery logs were removed. |
| S6-02 | Low, private image availability/error privacy | Returned SDK errors were generic, but thrown client/Auth/metadata/download errors escaped the route's response boundary. Raw exception details could reach framework logging. No ownership bypass was found. | Fixed within the image handler: the entire dependency sequence now returns the same private generic 404 on failure. Fourteen cases cover Auth-before-read, RLS-returned paths, normalized output, safe headers, returned failures, exceptions and body-read failure. Framework failures before the handler, including Proxy/configuration, remain outside this guarantee. |
| S6-03 | High before deployment, runtime maintenance | The actual reference image is `supabase/postgres:17.6.1.171`, with `server_version=17.6`. Later PostgreSQL releases include security fixes, including cached RLS plan invalidation after role changes. | Open: validate a supported Supabase CLI/image upgrade and rerun all checks before hosting. No vendor backport attestation or per-CVE exploitability proof was established. Loopback binding, synthetic data and restricted API roles reduce exposure but are not a patch. No ad hoc managed-image override was applied. |
| S6-04 | High upstream severity, development tooling | `npm audit` reports five affected package entries from one root advisory, GHSA-vfj7-8cjw-p6xm / CVE-2026-93687. `braces@3.0.3` is reached through Next's ESLint plugin and `fast-glob`/`micromatch`. | Open: no patched release was listed; registry latest remained 3.0.3. The suggested major downgrade to `eslint-config-next@14.2.35` is inappropriate for Next 16 and was not applied. Full audit remains nonzero. Production-only audit reported zero advisories. Review upstream before release. |
| S6-05 | High for an unrestricted paid/public service | Three attempts per story, bounded request bodies/images and provider timeouts do not bound new stories, accounts, connections, total storage, decode CPU or provider spending. | Open deployment requirement: enforce account/global quotas, rate limits, cost caps and operational monitoring. Default mock mode makes no paid requests. |
| S6-06 | Medium, cross-service integrity | Storage permission preflight and byte writes are not transactional with application metadata deletion. Late uploads may leave orphaned bytes. | Open deployment requirement: audited reconciliation plus fault/concurrency tests. Current Storage-first deletion and metadata guards remain; no direct Storage metadata deletion was introduced. |
| S6-07 | Deployment/privacy review | Production SMTP, HTTPS/cookies/headers, bot protection, real child-data consent/retention, provider content safety, hosted Realtime settings, token revocation requirements and human review are not established by this local app. | Open before a public or real-data deployment. Mock fixtures and local authorization tests do not establish these controls. |

The observed Next ESLint source calls `fast-glob` for configured `settings.next.rootDir` patterns. This repository supplies no such custom glob and application requests do not call that development utility. This narrows S6-04's observed exposure; it does not remove the vulnerable dependency or justify suppressing its advisory. CI has a production dependency audit gate; the full development advisory remains visible in this report.

## Boundary review and evidence

| Boundary | Reviewed controls | Local evidence |
| --- | --- | --- |
| Auth and sessions | Request-scoped SSR client; verified `getClaims` in Proxy and independent `getUser` at data boundaries; fixed-origin PKCE callback; no unverified session user as authority; refresh cookies retained | `auth-actions`, `auth-callback`, `auth-proxy`, `auth-validation` unit suites and Auth browser flows |
| CSRF, redirects and caching | Server Action origin protection; fixed callback/sign-out destinations; SameSite=Lax; private/no-store responses; no user-controlled redirect origin | Unit negative cases, production build, Auth browser tests. Production HTTPS and global headers remain S6-07. |
| Database tenancy | Four public tables with RLS and explicit least-privilege grants; immutable owner/managed columns; parent-based child access; no anonymous table grants | 299 pgTAP assertions, database lint/types/advisors; performance queries run as non-bypass `authenticated` and prove other-owner denial |
| Elevated SQL | Private unexposed lifecycle functions with empty search paths, fixed SQL, explicit owner checks and a worker capability; public wrappers are invokers; deletion guard is trigger-only | Generation and Storage SQL tests verify direct write/execute denial, invalid capability, lease/attempt bounds and stale completion. No new definer or migration in Phase 6. |
| Generation and AI | Authenticated Edge entry; public API key/caller JWT; strict UUID-only request; server-selected provider; worker header only on claim/finish; bounded JSON, output, timeout and fixed HTTPS provider URL; escaped text | Handler/provider unit suites; live local mock Edge integration including competing requests. Live Gemini, load and suitability testing remain unexecuted. |
| Storage and images | Private bucket; owner namespace and metadata checks; immutable reservations; no upsert; decode/re-encode, size/pixel/time bounds; private authenticated image route | Image byte/MIME/animation tests, new route failure tests, Storage pgTAP and browser cross-owner/anonymous/raw API checks |
| Realtime | Private channel/producer flags; owner receive-only topic policy; no client send or Presence policy; minimal invalidation payload; verified database refresh; reconnect/sign-out teardown | SQL probe-shape tests, lifecycle units, browser private/public isolation, forged-send rejection, offline catch-up and cross-tab logout |
| Local isolation and secrets | Fixed project/config/socket/ports; no hosted targeting or arbitrary forwarded arguments; loopback bindings; ignored 0600 environments; no privileged application client | Guard tests, live startup validation, tracked-file pattern scan, exact Edge-secret comparison against browser bundles and reuse manifest checks |

The browser bundle contains the Supabase SDK's literal `sb_secret_` **prefix check**, not an embedded secret value. No exact Edge secret or worker/provider environment marker was found in browser code. The tracked-file scan found no JWTs, private-key blocks, Google API keys or realistic secret-key literals. These scoped scans are not proof that every possible secret format or historical log has been checked. No Git history rewrite or unrelated account key rotation was performed.

Realtime authorization can remain cached until rejoin/new JWT/expiry, and local sign-out is not immediate access-token revocation. Private content reads still require fresh verified Auth and RLS. Browser event cleanup is a UX safeguard, not a replacement for authorization.

## Follow-up order

Before hosting, resolve the database patch baseline; recheck the development advisory; select a deployment target and define Auth/abuse/privacy controls; implement storage reconciliation; then perform independent human review and hosted regression/load verification. Do not claim this audit grants production approval. Phase 7's [deployment preparation](DEPLOYMENT.md) maps these findings to explicit release criteria without closing them. Its [execution record](PHASE-7.md) reports fresh local verification separately from this audit baseline.

## Primary references

- [PostgreSQL 17.11 security and upgrade notes](https://www.postgresql.org/docs/17/release-17-11.html)
- [Supabase upgrade guidance](https://supabase.com/docs/guides/platform/upgrading)
- [braces advisory and patch status](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Supabase product security](https://supabase.com/docs/guides/platform/going-into-prod)
- [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

## October 6–7 local-hardening follow-up

The table above is the historical Phase 6 assessment. Current changes are recorded in [LOCAL-HARDENING.md](LOCAL-HARDENING.md): S6-03 now has the supported CLI 2.119.0 / Postgres 17.11 local baseline; S6-05 has database account/service issuance and work limits; S6-06 has operator reconciliation with immutable path claims; S6-07 has nonce CSP, secure hosted configuration and invitation-only app signup. Provider-owned traffic/spend, SMTP, hosted verification and human review remain release requirements. Local rotation and separately guarded staging tools are described in [OPERATIONS.md](OPERATIONS.md).

The source-map-js advisory discovered October 5 was fixed by the compatible 1.2.2 patch. October 6 production dependency audit reports zero findings. The full audit still reports five high package entries from the single unpatched braces 3.0.3 advisory; registry latest remains 3.0.3. No exception was granted and no incompatible downgrade applied.

The October 7 audit newly reported [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) in Sharp's librsvg dependency. Applied the compatible Sharp 0.35.5 patch and blocked the SVG loader before metadata parsing. Rejecting SVG only after metadata inspection was insufficient to keep untrusted bytes out of that parser. A real decoder regression covers the earlier boundary; accepted PNG/JPEG/WebP normalization remains tested. This is a local mitigation and patch, not evidence that hosted binaries have been updated.

The post-patch October 7 audit returned zero production advisories and the same five development package entries for braces. The registry still lists braces 3.0.3 as latest; the upstream finding remains open.

## Publication follow-up, October 8

The later clean-install audit reported Next.js advisories affecting the previously pinned 16.3.6. The verified same-minor 16.3.8 security release and matching lint configuration were selected; [PUBLICATION.md](PUBLICATION.md) records patch validation separately from the earlier checkpoint. The development glob advisory remains open. The user selected a static read-only showcase with no backend resources for the first public release; that scope does not close full-application hosting or human-review gates.
