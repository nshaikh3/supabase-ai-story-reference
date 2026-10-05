# Phase 5 execution record

Status: implementation and acceptance checks passed on 2026-10-01. On 2026-10-04, final fixture cleanup is blocked by an unresponsive Docker daemon. Phase 6 has not started.

## Scope

Private database Broadcast notifications for generation jobs, owner-authorized story channels, live status and completed pages, reconnect reconciliation, session changes and cross-tab sign-out. The existing reference app and generic components are retained. No commercial source or services were changed.

## Implementation

The CLI-created sixth migration adds a receive-only policy to managed `realtime.messages` and an invoker trigger on new jobs and real status transitions. Canonical `story:<uuid>` topics require the authenticated story owner, matching row topic and Broadcast extension. No client INSERT or Presence policy exists. The trigger passes only story/job IDs and status to `realtime.send`; the pinned helper adds a message ID. Direct trigger EXECUTE is revoked. No new elevated function or application Postgres Changes publication is introduced.

The cookie-compatible browser client uses the existing publishable key and current user JWT. Notifications schedule a coalesced refresh of verified server state rather than updating display state from untrusted messages. Each join/rejoin and return online/visible reconciles missed events. There is no periodic polling. Offline/route/session teardown removes channels and cancels pending work; browser sign-out broadcasts the session event across tabs and leaves private screens with a fixed full navigation. A Server Action sign-out fallback remains available without JavaScript.

The receive policy does not filter the managed private column: Realtime's temporary authorization probe inserts only topic/extension and receives private=false by default. Producer and browser channel both explicitly select private transport. The database test includes that probe shape and cross-owner denial.

The existing local Docker adapter now waits for exact reference Storage/Realtime start and restart operations, including reset restarts. It retains the five-minute bound, actual health probes, cancellation and stopped/OOM/missing-probe failures. No unrelated containers or settings are changed.

## Verification

- `npm run check` passed on October 1 with the final application code. After the local Edge policy change, the final unit/type/lint run passed with 182 unit tests across 16 files. The production build remains current; subsequent edits affected configuration, tests and documentation. Tests cover envelope validation, subscription lifecycle, reconnect, teardown, token/identity changes, no interval polling and bounded service restart readiness.
- A fresh reference-only stop/start/reset succeeded with all six migrations and synthetic seeds. All 299 pgTAP assertions across seven files passed, including the corrected real authorization-probe shape. Database lint found no errors; generated types matched. Advisors returned only the intentional INFO for the deny-all private worker-key table.
- The focused Realtime browser scenario passed: owner access, other-owner/anonymous/malformed/missing-topic denial, no private messages on a public topic, forged-send rejection, all three minimal status messages, automatic page display, offline catch-up and cross-tab sign-out. Desktop and 390px mobile screenshots were reviewed; layout and overflow checks passed.
- In the first full browser run, five of six scenarios passed. The Realtime scenario exposed a fixture race: deleting its displayed story before logout allowed a pending refresh to replace the page and remove its session listener. Cleanup now runs after assertions; private pages must remain visible until logout. The subsequent full six-scenario run passed. Its persisted `test-results/.last-run.json` records `status: passed` with no failures at 13:16 on October 1; this was confirmed after resuming on October 4. Final desktop/mobile screenshots were reviewed again.
- Whitespace, local documentation links and all nine reused-file provenance hashes passed. A browser-bundle scan found no worker/provider secret markers. Ignored environment files remain mode 0600. No dependency was added. Temporary recovery logs were removed.

## Failures and resolutions

Earlier Docker attempts hit cold Storage health failures, database connection timeouts, and a container-removal error. The scoped readiness adapter was extended to actual Storage/Realtime restarts; no health check was skipped. The October 1 reference-only recovery and fresh reset succeeded. Other projects were untouched.

The initial receive policy incorrectly filtered `private=true`. Pinned server source and the actual managed default established that Realtime's authorization probe defaults false. The filter was removed while retaining owner/role/topic/extension checks, and two regression assertions were added. The initial 297-assertion pass is superseded by the corrected 299-assertion pass.

A first post-recovery browser run failed at the offline-generation invocation. Its error wrapper did not distinguish transport and HTTP failure, so no specific root cause is claimed. Safe HTTP diagnostics were improved; subsequent runs completed generation and offline recovery. The full-suite logout fixture race described above was then identified and corrected. Next also emitted closed-stream diagnostics during navigation; they were not suppressed and did not fail assertions.

A later full browser run identified the recurring generation failure as HTTP 546, with a CPU hard-limit shutdown in the reference Edge logs. The local runtime was reusing workers under the pinned CLI default `per_worker`. The configuration now explicitly selects the documented development policy `oneshot` without raising resource limits or disabling security checks. Runtime inspection verified Edge v1.76.2 running `--policy=oneshot`; startup verified loopback bindings. All six browser scenarios then passed without generation retries. The pinned per-request supervisor still enforces CPU, memory and wall-clock limits. This establishes local acceptance, not hosted load capacity.

Remaining closeout: remove synthetic Auth fixtures with a reference reset and rerun database checks after Docker recovery. Story/Storage browser cleanup completed in the successful suite. On October 4, a bounded Docker container-list call timed out. The guarded reset subsequently passed readiness but failed with `ContainerRemoveError`: Docker could not kill the reference database container and received no exit event. No schema reset or subsequent database checks completed in that attempt. Docker Desktop recovery is required. No other project was stopped or reset. The verified implementation is saved in a local commit; Phase 6 remains gated until the remaining local closeout succeeds.

## Security boundaries and next phase

Broadcast authorization is cached until token refresh/rejoin/expiry. Local logout cleanup is not immediate JWT revocation. Immutable ownership, minimal messages and fresh RLS-protected content reads bound the current design. Managed `realtime.send` is best-effort; reconnect/visibility/manual refresh recover current persisted state but do not promise delivery of every intermediate transition.

Live Gemini, hosted CI/deployment and human security review remain outside this local phase. Hosted preparation must review public-channel settings, JWT lifetime, connection/event quotas and explicit revocation if membership becomes mutable. Existing provider/content safety and Storage reconciliation work remains documented.

Phase 6 should perform the dedicated security audit and Postgres/RLS performance review, assess remaining abuse/resource controls and record findings before proposing changes beyond this phase.

## Sources

- [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Database change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- Installed Next.js `useRouter` guide and pinned Supabase SSR/Auth/Realtime source.
