# Security model

## Identity and session boundary

Phase 2 uses Supabase email/password Auth with email confirmation and PKCE. Sign-up and reset emails return to a fixed local callback, which exchanges the one-time code using the browser's verifier cookie. Links must be opened in the same browser. Invalid, expired, missing and reused codes produce a generic error. Request headers, form fields and `next` parameters cannot choose the redirect origin or destination.

Next.js Server Actions validate inputs and use its built-in POST/origin protection. Password changes verify the user again. Sign-out uses `scope: local` so it ends this session without signing out unrelated devices. Provider errors and submitted credentials are not logged or echoed. Recovery responses do not identify whether an email exists.

Every request gets its own `@supabase/ssr` client. Proxy verifies claims and refreshes cookies for Auth and account routes, passing cookies to both downstream server rendering and the browser. The protected account page and password action independently call `getUser()` at the data boundary. Unverified `getSession().user`, client-supplied IDs and editable user metadata never grant access.

Auth/account responses are dynamic and marked `private, no-store`; refresh cookies survive redirects. The callback sets `Referrer-Policy: no-referrer` and removes codes from the destination URL. Cookies use Supabase SSR's default encoding and SameSite=Lax. They remain browser-readable for compatibility with later Supabase browser features, so XSS prevention matters. React escapes text; no raw HTML or user-provided script is rendered. HTTPS and Secure cookies must be enforced before deployment; Phase 2 deliberately accepts only the fixed HTTP loopback development origins. Do not deploy these local guards or settings unchanged.

Sign-out revokes the refresh session; previously issued access JWTs can remain valid until expiry. RLS enforces ownership, not immediate per-token revocation. Sensitive future operations must explicitly decide whether to validate active sessions, shorten token lifetimes or require reauthentication. MFA, CAPTCHA, production SMTP and deployment security headers remain production-preparation work.

## Database authorization

All application tables have RLS enabled. Anonymous clients have no grants. Authenticated clients receive only the grants needed for their operation; no table-wide INSERT/UPDATE grant is used for stories. Policies target `authenticated` and use `(select auth.uid())`, with indexed ownership/parent lookups. Anonymous Auth sign-ins are disabled.

| Resource | Allowed operations | Protected fields / behavior |
| --- | --- | --- |
| Stories | Owner SELECT and DELETE; INSERT and UPDATE of title, child_name, prompt | ID, owner, status and timestamps cannot be supplied or overwritten; INSERT ownership and draft status checked; UPDATE checks old and resulting owner |
| Pages | Owner SELECT through parent story | All direct client writes denied; owned parent deletion cascades |
| Asset metadata | Owner SELECT through parent story | All client writes denied until private Storage policies ship; parent deletion cascades |
| Storage objects | None yet | Phase 3 must authorize both metadata and bytes |
| Realtime topics | None yet | Phase 5 must authorize private channels |
| Generation jobs | None yet | Phase 4 must enforce a controlled lifecycle |

An owner default is convenience, not authorization. RLS and column privileges are independent controls. A future broad table grant would weaken managed-field protection and must fail review and tests. Status transitions and concurrent editing during generation need a separate Phase 4 decision.

Ownership derives from the parent, with no duplicate owner field on children. No SECURITY DEFINER functions or exposed views were added. The timestamp trigger remains invoker-only in non-exposed `private`, with an empty search path and no client execute grants.

The database tests set actual API roles and synthetic request claims. They prove own-row CRUD, cross-user denial, inaccessible child writes, forbidden field changes, absent-identity denial and parent cascades. A separate transaction-only grant section tests RLS independently. Test changes roll back. Database-admin setup is never counted as client authorization.

## Local tooling and data

Wrappers validate project identity, ports, Auth redirects and security settings, exposed schema and explicit grants. They reject hosted links and arbitrary arguments, strip hosted credentials, and require a local Docker socket. The Docker adapter affects only this project's containers. Startup verifies actual loopback bindings; failures stop reference containers and retain volumes. Developer access to Docker and the database remains privileged.

`npm run local:env` captures CLI status without displaying it, writes only an allowlist of three public settings to ignored `.env.local` with mode 0600, and refuses to overwrite a differing existing file. Application configuration accepts only this reference stack's URL and a publishable key. No service-role or secret key is used by the app.

MCP is privileged local development tooling, not end-user authentication. Core mode omits Studio and MCP to reduce memory use. No hosted project is connected. Other projects' containers and data must not be stopped, pruned or reset by reference tooling.

Fixtures use synthetic identities and fictional text. Browser tests generate random local credentials for `phase2-…@example.test` users and read only their own local test mailboxes; traces, videos and screenshots are disabled. A fresh reference DB reset removes generated test users. Mail is captured locally, not sent through production SMTP. No commercial environment files, customer data, prompts, payment code or assets were copied.

Never log access tokens, keys, passwords, emails, child names, full prompts or generated outputs. Keep operational logs to identifiers, operation, duration and safe error codes. CLI status includes local privileged credentials, so do not paste its raw output into issues or public documentation.

## Verification boundaries

Actual results are recorded in PHASE-2.md. Human security review and the Phase 6 audit remain pending. Hosted CI, production deployment, object access, jobs and private channel authorization are not established by Phase 2 checks.
