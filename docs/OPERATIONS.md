# Reference operations

These are implemented local tools. They never accept a hosted URL, project override, arbitrary SQL, alternate container, or forwarded CLI flags. They inspect the exact reference Docker container/network/loopback bindings and require a local Unix socket. No commercial project is used. Deployment and hosted operation remain separately authorized work.

## Admission and capacity

`npm run ops:status` prints only aggregate counts and booleans. `npm run ops:pause` disables new story/edit, generation, upload and image-processing admission. Reads, deletion and completion of already-running work remain available. `npm run ops:resume` explicitly resumes the reference; it refuses an unfinished worker recovery file. Database migrations start with all controls disabled; only the disposable local seed enables them automatically. Applying migrations to a future hosted database does not enable traffic.

| Operation | Account limit | Whole reference limit | Window |
| --- | --- | --- | --- |
| Story creation | 20 | 500 | UTC day |
| Current stories | 50 | 1,000 | Current stored rows |
| Story edits | 120 | 1,200 | UTC minute |
| Generation attempts | 20 | 100 | UTC day, plus three attempts/story |
| Active provider execution | 3 | 8 | Two-minute execution lease |
| New image reservations | 10 | 200 | UTC day; at most 2 MiB/object |
| Image processing | 120 | 1,200 | UTC minute |
| Active image processing | 2 | 8 | 60-second lease |

Counters serialize through a private row within short SQL transactions. A rejected mutation rolls back its charge; a successfully issued resource stays charged after deletion. Idempotent generation reuse is not charged twice. Fixed windows can admit a burst on either side of a boundary; these are issuance budgets, not smooth traffic shaping. Deleting a story does not release an already-dispatched provider execution lease. Image work acquires a private unpredictable lease before downloading/decoding and releases it in `finally`; network and decode deadlines are shorter than lease validity. A crashed operation expires without a privileged application client.

`npm run ops:maintenance` removes counters older than two days and expired work leases. Run it as a protected scheduled operator job in a future deployment; no scheduler or notification service was installed here. It retains immutable path tombstones. Counter rows and tombstones are private security metadata, including pseudonymous UUIDs; they contain no prompts, emails, image bytes or story text. A production retention/erasure policy must explicitly cover that metadata.

Storage still allows an owner to read/remove/re-upload an existing reservation through its API. Auth traffic, failed requests, WebSocket connections and raw Storage transfer bytes are outside these SQL issuance budgets. Configure provider-owned rate limits, egress/spending alerts and an incident owner before release. A website password alone cannot control a separately reachable Supabase API. Pausing admission is a graceful stop: a Storage upload already authorized in another transaction may finish.

## Reconcile orphaned images

1. Run `npm run ops:cleanup`. This is a dry run. It writes `test-results/operations/storage-cleanup.json` with mode 0600 and prints its SHA-256 digest and aggregate counts. Review the file locally; do not publish it.
2. Candidates must be in `story-assets`, at least 24 hours old, have a canonical owner/story/file UUID path and matching Storage owner, and have no attached metadata or unexpired job. Batches contain at most 100 objects. Malformed or unknown ownership is excluded, never guessed.
3. Only after reviewing that concrete report, run `npm run ops:cleanup:apply -- <reviewed-sha256>`. The report must belong to this exact project and be no more than one hour old. Arbitrary file paths and flags are rejected.
4. Each candidate receives a permanent retired-path claim through the same unique registry used by asset INSERT. A reservation that wins first blocks cleanup. A cleanup claim that wins first blocks future attachment. The tool then rechecks object ID/version, ownership, age and active use immediately before calling the Storage DELETE API. It never deletes managed Storage SQL rows.
5. An API failure stops the batch and retains the report and retired names. Re-plan before retrying a stale/changed report. A late upload can reappear on a retired path; it can never become newly attached legitimate data, and a later pass removes it. This is eventual reconciliation, not a distributed transaction.

The operator alone reads a local privileged key into memory for the Storage deletion call. Its process uses the exact verified local API URL, denies redirects and bounds network time. The key is never written to the report, application environment or logs. Application and Edge clients still use publishable keys with the caller JWT. SQL authorization tests cover both registry race outcomes; transport fixtures cover age/identity changes and partial failures. The live local dry run had no orphan candidates; no existing user image was deleted by the operator test.

## Rotate the local worker capability

`npm run ops:worker:rotate` pauses new generation, waits for active execution leases to drain/expire, writes a new random 256-bit capability, recreates only this project's core stack, provisions the hash, verifies the runtime secret file and database hash agree, and restores the previous generation admission state. It retains the provider setting and any existing provider configuration. No secret value is printed. The stack restart temporarily interrupts local Auth/Storage/Realtime availability; ordinary `docker restart` cannot reload a changed container environment.

The old Edge environment remains in mode-0600 `test-results/operations/worker-recovery.env` until successful verification. If any step fails, inspect `npm run ops:status`; generation stays paused before verification, and an uncertain resume triggers a best-effort re-pause. Do not resume while configuration is mismatched. Resolve the failure, restore the private recovery environment to `supabase/functions/.env` if necessary, recreate the reference with `npm run supabase:stop` then `npm run supabase:start:core`, run `npm run generation:setup`, and verify a mock generation in the browser. Remove the recovery file only after verification, then explicitly resume if appropriate. Preserve mode 0600. Do not paste either environment file into diagnostics.

The schema uses a single capability hash. Pausing and draining avoids changing it while a normal provider call is running. Revoking a user session is separate from capability rotation and does not instantly invalidate a previously issued access JWT.

## Prepare a hosted worker handoff without deployment

`npm run release:worker:prepare` performs no network request. It requires a reviewed non-null target in [targets.json](../deployment/targets.json) and matching private process variables `REFERENCE_RELEASE_ENV` (`staging` or `production`), `REFERENCE_RELEASE_PROJECT_REF`, and `REFERENCE_RELEASE_AUTHORIZATION` (both exact reference). It generates fresh mock-only material under ignored `test-results/worker-handoff/`: `worker.env`, hash-only `provision.sql`, and nonsecret target metadata. Every file is 0600 and must not already exist.

Preparation is not target verification or deployment. A separately authorized release operator must compare the live project ref/name with the manifest using a project-scoped credential, pause/drain generation, apply the hash transaction to that exact reference, and load the matching Edge secret through the hosted secret store. Never copy the local worker capability. Verify missing/old capability denial plus a valid owner mock generation before enabling admission. Keep the target unlinked from this development checkout. Dispose of prepared secret material through the release secret-handling process after successful setup.

## Staging configuration and browser verification

Both hosted manifest entries are intentionally null. `npm run staging:preflight`, `npm run test:staging` and the worker preparation command fail closed until a target is explicitly configured and authorized. The ordinary local scripts and local browser helpers remain fixed to loopback.

Set `REFERENCE_STAGING_PROJECT_REF` and `REFERENCE_STAGING_AUTHORIZATION` to the reviewed staging ref. Preflight additionally requires `REFERENCE_STAGING_MANAGEMENT_TOKEN`, a project-scoped PAT (prefix `sbp_fc`) with **Read** permissions for Project Settings, Auth Config, Realtime Config, Storage Config and Database. It checks the live ref/name before reading service configuration. Its fixed database request uses the documented read-only query endpoint and reads only bucket configuration. Unknown/missing fields and any request failure fail closed; raw configuration responses are never printed. No configuration is changed.

Preflight requires Postgres 17.11+, healthy exact identity, exact HTTPS Auth site/callback, signup disabled, confirmed email, anonymous Auth disabled, refresh rotation, ten-character minimum passwords, JWT lifetime at most one hour, custom SMTP and finite Auth/Realtime limits, a private raster-only 2 MiB bucket, and disabled managed image transformations. See [staging-contract.mjs](../scripts/staging-contract.mjs) for the explicit conservative maximums. Read-only bucket visibility may require platform support; a permission failure is a release failure, not a reason to add public bucket access.

The browser harness also needs two separately invited synthetic accounts, `REFERENCE_STAGING_EMAIL_A/B` matching `staging-<uuid>@example.test`, the staging publishable key in `REFERENCE_STAGING_PUBLISHABLE_KEY`, and a protected Mailpit-compatible test mailbox at the manifest's `testMailOrigin`, authenticated with a complete `Basic <base64(user:password)>` header supplied privately as `REFERENCE_STAGING_MAIL_AUTHORIZATION`. This matches native Mailpit UI/API Basic authentication; protect the mailbox with HTTPS and dedicated credentials. Configure that isolated SMTP sink before invitations. The harness uses actual password-recovery email and same-browser PKCE to establish those invited sessions. It never creates an administrator session or enables signup. Ordinary confirmation/invitation delivery is a separate release acceptance check; open signup is deliberately unavailable.

The separate [staging browser suite](../tests/staging/reference.spec.mts) checks HTTPS headers, Secure cookies, recovery/PKCE, two-owner Data API/Edge isolation, five-page mock generation, private image access and fixture cleanup. A preflight runs before the suite. Credentials, messages and sessions remain in memory; traces, screenshots and video are disabled. Actual hosted execution has not occurred. The full release matrix, including connection recovery, abuse/spend controls and backup/object restore, remains in [DEPLOYMENT.md](DEPLOYMENT.md).

Sources checked October 6: [scoped PAT permissions](https://supabase.com/docs/guides/platform/personal-access-tokens), [Management API specification](https://github.com/supabase/supabase/blob/master/apps/docs/spec/api_v1_openapi.json), [Storage managed-schema ownership](https://supabase.com/docs/guides/storage/schema/design) and [Mailpit API authentication](https://mailpit.axllent.org/docs/api-v1/). Hosted APIs remain subject to provider changes; recheck the contract before a future release.
