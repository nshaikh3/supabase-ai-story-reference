# Security model

## Identity and session boundary

Phase 2 uses Supabase email/password Auth with email confirmation and PKCE. Sign-up and reset emails return to a fixed local callback, which exchanges the one-time code using the browser's verifier cookie. Links must be opened in the same browser. Invalid, expired, missing and reused codes produce a generic error. Request headers, form fields and `next` parameters cannot choose the redirect origin or destination.

Next.js Server Actions validate inputs and use its built-in POST/origin protection. Password changes verify the user again. Sign-out uses `scope: local` so it ends this session without signing out unrelated devices. Provider errors and submitted credentials are not logged or echoed. Recovery responses do not identify whether an email exists.

Every request gets its own `@supabase/ssr` client. Proxy verifies claims and refreshes cookies for Auth, account, story, dashboard and asset routes, passing cookies to both downstream server rendering and the browser. Protected pages, mutation actions and the image route independently call `getUser()` at the data boundary. Unverified `getSession().user`, client-supplied IDs and editable user metadata never grant access.

Auth/workspace/image responses are dynamic and marked `private, no-store`; refresh cookies survive redirects. The callback sets `Referrer-Policy: no-referrer` and removes codes from the destination URL. Cookies use Supabase SSR's default encoding and SameSite=Lax. They remain browser-readable for compatibility with later Supabase browser features, so XSS prevention matters. React escapes text; no raw HTML or user-provided script is rendered. HTTPS and Secure cookies must be enforced before deployment; Phase 2 deliberately accepts only the fixed HTTP loopback development origins. Do not deploy these local guards or settings unchanged.

Sign-out revokes the refresh session; previously issued access JWTs can remain valid until expiry. RLS enforces ownership, not immediate per-token revocation. Sensitive future operations must explicitly decide whether to validate active sessions, shorten token lifetimes or require reauthentication. MFA, CAPTCHA, production SMTP and deployment security headers remain production-preparation work.

## Database authorization

All application tables have RLS enabled. Anonymous clients have no grants. Authenticated clients receive only the grants needed for their operation; no table-wide INSERT/UPDATE grant is used for stories. Policies target `authenticated` and use `(select auth.uid())`, with indexed ownership/parent lookups. Anonymous Auth sign-ins are disabled.

| Resource | Allowed operations | Protected fields / behavior |
| --- | --- | --- |
| Stories | Owner SELECT and DELETE; INSERT and UPDATE of title, child_name, prompt | ID, owner, status and timestamps cannot be supplied or overwritten; INSERT ownership and draft status checked; UPDATE checks old and resulting owner |
| Pages | Owner SELECT through parent story | All direct client writes denied; owned parent deletion cascades |
| Asset metadata | Owner SELECT/DELETE; restricted hero INSERT | Immutable paths, identity and timestamps; current-owner namespace and parent checked; one hero per story; committed object blocks deletion |
| Storage objects | Owner SELECT/INSERT/DELETE at a reserved path | Private bucket; owner namespace and RLS-visible metadata; no upsert/move or anonymous policy |
| Realtime topics | Owner SELECT authorization for private Broadcast | Exact story topic and parent ownership; no client sending or Presence |
| Generation jobs | Owner SELECT; narrow lifecycle RPCs | Owner enqueue; worker capability additionally required for claim/completion |

An owner default is convenience, not authorization. RLS and column privileges are independent controls. A future broad table grant would weaken managed-field protection and must fail review and tests. Phase 4 constrains transitions and concurrent editing as described below.

Ownership derives from the parent, with no duplicate owner field on children. No exposed views are present; Phase 4 lifecycle RPCs are described below. Phase 3 adds one trigger-only SECURITY DEFINER deletion guard, described below. The timestamp trigger remains invoker-only in non-exposed `private`, with an empty search path and no client execute grants.

The database tests set actual API roles and synthetic request claims. They prove own-row CRUD, cross-user denial, inaccessible child writes, forbidden field changes, absent-identity denial and parent cascades. A separate transaction-only grant section tests RLS independently. Test changes roll back. Database-admin setup is never counted as client authorization.

## Local tooling and data

Wrappers validate project identity, ports, Auth redirects and security settings, exposed schema and explicit grants. They reject hosted links and arbitrary arguments, strip hosted credentials, and require a local Docker socket. The Docker adapter affects only this project's containers. Startup verifies actual loopback bindings; failures stop reference containers and retain volumes. Developer access to Docker and the database remains privileged.

`npm run local:env` captures CLI status without displaying it, writes only an allowlist of three public settings to ignored `.env.local` with mode 0600, and refuses to overwrite a differing existing file. Application configuration accepts only this reference stack's URL and a publishable key. No service-role or secret key is used by the app.

Startup also captures both CLI output streams and discards them on success or failure; only fixed process-status messages leave the wrapper. This closes the Phase 6 finding that startup's credential summary could enter terminal/CI logs. Safe status codes remain available; raw service errors are deliberately withheld.

MCP is privileged local development tooling, not end-user authentication. Core mode omits Studio, postgres-meta and MCP to reduce memory use. No hosted project is connected. Other projects' containers and data must not be stopped, pruned or reset by reference tooling.

Fixtures use synthetic identities and fictional text. Browser tests generate random local credentials for `phase2-…@example.test` / `phase3-…@example.test` users and read only their own local test mailboxes; Auth traces, videos and screenshots are disabled. The story test writes explicit screenshots of fictional story content only, to ignored test-results/. A fresh reference DB reset removes generated test users. Mail is captured locally, not sent through production SMTP. No commercial environment files, customer data, prompts, payment code or assets were copied.

Never log access tokens, keys, passwords, emails, child names, full prompts or generated outputs. Keep operational logs to identifiers, operation, duration and safe error codes. CLI status includes local privileged credentials, so do not paste its raw output into issues or public documentation.

## Verification boundaries

Actual results are recorded in PHASE-2.md through PHASE-6.md. The [Phase 6 agent audit](SECURITY-AUDIT.md) records fixed findings and open dependency/runtime/deployment requirements. Human security review, hosted CI and production deployment remain unverified. Private object and channel authorization are covered by local tests. The full dependency audit is not clean: the unpatched development-only glob advisory remains documented separately from the passing production audit.

## Private images and cleanup

The bucket is private, capped at 2 MiB and limited to PNG/JPEG/WebP MIME types. Application validation decodes pixels with Sharp (16 million input pixels, strict warnings, ten-second processing timeout), rejects type mismatches and animated inputs, auto-orients and resizes to 1600×1600 bounds, and writes WebP without source EXIF/GPS/ICC metadata. Next's Server Action body limit is 3 MiB to allow multipart overhead; browser and server validation enforce the stricter image limit. Filenames are generated UUIDs, never submitted names or URLs. No remote image is fetched from user input.

A direct Storage caller can spoof MIME; bucket MIME filtering is not byte validation. `/assets/[id]` therefore independently verifies Auth, looks up metadata under RLS, downloads under the same user JWT, and decodes/re-encodes before display. It serves only WebP pixels with private/no-store, nosniff, same-origin resource policy and restrictive CSP. Missing, malformed, unauthorized and unrenderable assets all yield a generic 404. Thrown dependency and byte-read errors inside this handler use that same response without forwarding raw exceptions to framework logs. No public or signed bearer URL is handed out, and no shared image-optimizer cache stores private images. Supabase's own authorized Storage API remains available to the owner.

Metadata reservation precedes byte upload. Duplicate hero uploads lose at the unique index. Failed/uncertain uploads retain a visible reservation so the user can remove and retry. Deletion accepts IDs only, resolves paths from owner-visible database rows, calls Storage remove first, and retains relational data when that call fails. The trigger-only definer guard blocks metadata/parent cascades while a committed Storage object exists; it has no client EXECUTE privilege, fixed empty search_path, no arguments or dynamic SQL, and only reads Storage metadata.

**Limit:** this does not make a distributed transaction. Storage v1.77.0 checks RLS before storing bytes and completes database writes using its internal privileged context. A concurrent delete after preflight can race a late upload; a timeout can leave the outcome uncertain. The application reports recoverable failures but cannot prove absence of every late or orphaned object. Before production, add an audited reconciliation/cleanup workflow, quotas/rate limits and fault/concurrency tests. Do not describe the current guard as concurrency-safe or delete Storage metadata directly through SQL. Reference tests use fictional images, and their actual byte objects are explicitly removed through Storage before database reset.

The image transform has bounded size/time per request, but no per-user rate limit, global transform queue, malware scanner or production storage quota is implemented in this local phase. The Phase 6 audit records these as deployment requirements; human review and dependency/native-decoder maintenance remain necessary. Never use real children's photos or private content for public demonstration fixtures.

## Generation boundary (Phase 4)

The app and Edge Function use public API keys with the caller's JWT. Edge verifies the bearer token through Auth `getUser` even with gateway verification enabled, then reads the story under RLS. Missing and other-owner story IDs get the same unavailable response. Request bodies accept only a story UUID; callers cannot select the provider, supply an owner ID, publish arbitrary pages, or write job states directly.

Only owner enqueue is freely callable by an authenticated user. Claim/finish additionally verify an Edge-only random capability against a hash in `private.generation_worker_key`. Edge sets this header itself only on claim/finish RPCs, ignoring any incoming worker header; Auth and ordinary read requests never receive it. Public RPC wrappers are invokers; private definer functions use an empty search path, fixed SQL and explicit `auth.uid()`/story checks. Private schema USAGE allows the wrappers to execute named helpers but does not expose the schema through PostgREST or grant table access. Worker-key SELECT and mutation are denied to client roles; no client policy exists. A leaked capability alone does not authorize another owner's story, but capability leakage still requires rotation. Never log headers, provider keys, raw errors or story prompts.

The local startup script writes a fresh 256-bit capability to ignored `supabase/functions/.env` with mode 0600 if absent. The fixed local reset/setup operation uses only the exact reference database container to write its validated hexadecimal hash. It cannot accept a hosted URL or alternate container. Hosted provisioning and key rotation need separate reviewed deployment work.

Input locks and story row locks prevent editing races from changing an active provider request. Partial uniqueness prevents two active jobs. The two-minute lease plus job ID prevents stale writes; page insertion and job/story completion are transactional. Explicit retries stop after three attempts per story. Deletion cascades jobs, preventing late output from resurrecting deleted content; already-dispatched provider work may still consume resources. This is a bounded request/response workflow with manual recovery, not a durable delivery queue or account-wide abuse limit.

Mock mode makes no external AI request. Optional Gemini sends only title, fictional hero name and idea to Google's fixed HTTPS endpoint. Its API key is in a header, redirects are rejected, output byte size and time are bounded, and JSON/page order/text size are revalidated before persistence. Provider instructions cannot change permissions or call tools. Rendering remains escaped plain text. Structural validation and prompting are not moderation or a guarantee of suitable content. Global quotas, provider safety evaluation, consent/privacy review for real data and a human security audit are still required before a public deployment.

## Realtime boundary (Phase 5)

The database emits private `generation_status` messages only for new jobs or real status transitions. An invoker-only trigger inherits the existing lifecycle's authorized execution context; there is no new SECURITY DEFINER helper. Its direct EXECUTE is revoked from client roles. Realtime owns its message table and RLS setting; the migration adds only the owner SELECT policy. Existing managed grants do not grant row access without that policy. No INSERT policy means even an owner cannot forge private status notifications. Presence is excluded. The policy deliberately accepts the managed authorization probe, which inserts only topic/extension and defaults private=false. Message/channel privacy is a separate transport boundary enforced by the explicit private flags.

Payloads contain only four fields: generated message ID, job ID, story ID and status. They are invalidation hints. The browser validates the envelope, then requests fresh server-rendered state through verified Auth and RLS. It never renders arbitrary Broadcast text or applies event status directly. Initial subscribe, reconnect, token refresh and returning online/visible reconcile state; bursts are coalesced and no polling timer is used. Disconnects show a manual-refresh fallback.

The browser uses only the existing publishable key and cookie session. JWTs are never logged. Auth identity changes, logout, route teardown and offline transitions remove the channel and cancel pending refreshes. Browser sign-out broadcasts the SDK's session event across tabs; story tabs perform a fixed full navigation to clear private cached content. The no-JavaScript Server Action fallback cannot broadcast browser events, but a returning story tab rereads its cookie session before resuming.

Realtime caches authorization until rejoin/new JWT or expiry. Local UI cleanup is not token revocation: a modified client holding an unexpired JWT can still exercise the owner's permissions. Story owner IDs cannot transfer, deletion prevents future job mutations, and every content refresh checks authorization again. Before hosting, disable public access globally, review connection/event limits and JWT lifetime, and design explicit revocation if mutable membership is introduced. Local tests distinguish rejected private joins from public topics, which may be joined but never receive private database events. Broadcast is not guaranteed delivery; missed notifications are recovered on reconnect/visibility or manual refresh, and do not change persisted generation results.
