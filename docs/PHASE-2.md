# Phase 2 execution record

Status: Phase 2 complete. All local acceptance gates passed; Phase 3 has not started.

## Scope and starting point

Phase 1 was committed and clean before this work. It supplied three RLS-enabled tables with no client grants, local synthetic identities, a static Next.js page and isolated Supabase tooling. The user authorized Phase 2 on 2026-09-28. No changes to the commercial app, production services or hosted Supabase are authorized by this phase.

## Implementation

- Email/password registration, confirmation using PKCE, sign-in, current-session sign-out, password recovery and password changes.
- Per-request SSR client using only this project's local publishable key. Proxy refreshes cookies, verifies claims and prevents shared caching. The protected account page and password action check the current user with Auth independently of Proxy.
- A protected account page with an RLS-scoped story count. Story CRUD UI remains Phase 3.
- A CLI-created migration grants owners SELECT/DELETE and INSERT/UPDATE of story title, fictional hero name and prompt. Owner, ID, status and timestamps are server-managed. INSERT and UPDATE policies validate resulting ownership.
- Pages and asset metadata have SELECT policies derived from the parent story. Their client writes remain denied pending their corresponding implementation phases. No definer function, privileged application key or extra ownership column is introduced.
- Unit tests for configuration, validation, actions, callback redirects and cookie refresh. Database authorization tests for anonymous, missing identity, Alice and Bob; both real grants and independent RLS checks. Browser tests exercise the full local Auth flow.

## Acceptance gates

- Fresh local reset, complete pgTAP suite, database lint and generated-type comparison.
- Repeat reset and database suite for migration reproducibility.
- Unit tests, typecheck, lint and production build.
- Browser sign-up, email confirmation, unconfirmed/wrong-password denial, persistent session, refresh, sign-out, password recovery and route protection.
- Final review of grants, mutation boundaries, callback destinations, cookie/cache behavior, secrets and documentation.

## Environment observations

The existing reference stack had unhealthy containers after the laptop had been idle. Docker showed timeouts even while starting health checks. The first reference-only stop returned StopContainerError; inspection subsequently showed the reference containers had stopped. Core mode restored healthy services and is retained to reduce resource use; other projects' containers were not stopped. Studio/MCP are unavailable in core mode.

## Results

Executed on 2026-09-28–29 UTC:

- 75 Vitest tests passed across seven files: local boundaries, Docker adapter, public environment generation, input validation, Auth actions, callback handling and session Proxy behavior.
- 178 pgTAP assertions passed across four files after each of two fresh database resets. The final reset also removed the random browser-test identities.
- Database lint found no schema errors in public/private on both runs.
- Official local security and performance advisors, including informational findings, reported no issues on both runs.
- Generated database types matched the checked-in artifact after both resets; this phase changes policies/grants, not column shapes.
- TypeScript, ESLint and the production Webpack build passed. The Auth/account routes are dynamic; the landing page remains static.
- All three Playwright scenarios passed in local Google Chrome: forged/anonymous access denial; safe uncached callback errors; and registration, unconfirmed-user denial, email confirmation, account isolation, reload, cookie refresh, sign-out, wrong-password denial, sign-in and password recovery/change. The refresh test forces the SDK's expiry path while retaining a valid refresh token, then verifies the updated cookie reaches the browser.
- The sign-up page was visually inspected in the desktop browser, including the page heading and labeled fields.
- npm audit reported zero known vulnerabilities. All nine reused files still match their recorded hashes. `.env.local` has mode 0600 and is ignored, as are build/runtime/test artifacts. The source/SQL/docs secret-pattern scan and Git whitespace checks were clean.

## Resolved failures

- Reference Docker health/stop delays: recovered using reference-only core mode, without stopping the commercial stack.
- Three Next.js navigation lint errors: changed internal navigation to Link and disabled Auth-route prefetching.
- Playwright initially loaded the local ESM guard as CommonJS: made the test/config explicitly `.mts`.
- A browser alert selector also matched Next.js's accessibility announcer: scoped assertions to the main content.
- Cold local Auth responses exceeded the first short browser assertion deadline: increased the browser allowance; Auth logs confirmed successful requests.
- The mail helper initially used an Inbucket endpoint: switched to the actual Mailpit API, filtered to the exact synthetic recipient.
- Automatic approval briefly blocked browser execution because of account usage limits. Tests resumed after the user's continue instruction.

No required local check remains failing.

## Remaining boundaries and next phase

No user action, hosted account, paid API key or commercial credentials are needed for the completed local implementation. To try it, register through `/sign-up` and confirm using the local mailbox in the same browser. Alice/Bob seed identities are SQL fixtures, not login accounts.

Hosted CI has been configured but not executed. Human security review and the Phase 6 audit remain pending. Only local Chrome browser execution is verified here; CI is configured for Chromium. Core mode deliberately omits Studio/MCP; switch to full mode only when needed. Production Auth requires a separate deployment/security review (HTTPS/Secure cookies, SMTP, abuse protection, origins and session-revocation requirements).

Phase 3 should implement the story dashboard and owner CRUD UI, private Storage and secure uploads. Add object/metadata ownership tests, upload constraints and cleanup behavior together. Keep generation workers, lifecycle transitions and Realtime in their planned later phases.
