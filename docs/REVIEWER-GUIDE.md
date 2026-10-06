# Review this project in 10–15 minutes

This is a working local reference, with deterministic mock generation and a documented path toward hosting. No public demo or public source URL is claimed. It demonstrates a small ownership model through Auth, SQL, private files, live notifications and controlled AI execution. The open [security audit findings](SECURITY-AUDIT.md) are part of the evidence, not hidden from the review.

## Five-minute source tour

| Time | Inspect | What to look for |
| --- | --- | --- |
| 1 minute | [Architecture](ARCHITECTURE.md), [schema](DATABASE.md) | One immutable story owner; child ownership derives from the parent; application and operator trust boundaries |
| 2 minutes | [Owner authorization migration](../supabase/migrations/20260928202944_add_owner_authorization.sql), [role tests](../supabase/tests/database/authorization.test.sql) | Both allowed and denied operations; column grants protecting owner/status; actual client roles and separate RLS checks |
| 1 minute | [Generation lifecycle](../supabase/migrations/20260929231039_add_generation_lifecycle.sql), [Edge handler](../supabase/functions/generate-story/handler.ts) | Caller JWT plus narrow worker capability; row locks, partial unique active-job index, lease and atomic completion |
| 1 minute | [Realtime migration](../supabase/migrations/20260930142245_add_private_generation_broadcast.sql), [client lifecycle](../src/lib/stories/realtime.ts) | Private receive-only topics; minimal hints; authorized refetch, reconnect and session teardown |

Then inspect [private image handling](../src/app/assets/[id]/route.ts), [security tradeoffs](SECURITY.md), [measured RLS plans](PERFORMANCE.md), and [AI-assisted development/provenance](AI-DEVELOPMENT.md). Automated evidence is in the phase records, with latest preparation results in [Phase 7](PHASE-7.md).

## Local walkthrough

Follow [README setup](../README.md#local-setup) first. Use `127.0.0.1` consistently. Seeded Alice/Bob rows are SQL fixtures; they are not login credentials.

1. Register with a synthetic address such as `reviewer-a@example.test` and a new local-only password. Open the local mail inbox at `http://127.0.0.1:55324` and confirm in the initiating browser. Never use a customer identity or commercial account password.
2. Open **My stories → New story**. Try title “Nova and the silver compass,” hero “Nova,” and idea “A fictional explorer helps a fox find a moonlit garden.” Save the draft. Attach a synthetic PNG/JPEG/WebP if desired; no real child's photo.
3. Open that story in a second tab of the same browser and wait for **Live updates connected**. Press **Generate story** in the first tab. Both tabs should show five pages and completed history without refreshing. Mock output is deterministic and free of provider calls.
4. Create another draft and open it in two tabs. With browser developer tools, take one tab offline, generate that same story from the online tab, then reconnect the offline tab; persisted state should reconcile. A reconnect may skip intermediate states because Broadcast is not a durable event queue.
5. In a separate browser profile/incognito context, register a second synthetic account through its own confirmation flow. Paste the first account's story URL. Its private content must be unavailable. The automated suite also exercises direct Data API, Edge, Storage and private-topic denial.
6. Sign out of the first account. Other open story tabs should leave the private content. Access-token expiry remains a separate server security boundary; UI logout is not immediate JWT invalidation.
7. Remove synthetic images and delete the review stories through the UI. If you choose `npm run db:reset` afterward, it deletes **all local reference accounts/stories**, including your walkthrough account, and restores only SQL fixtures. It must never target another project.

For a deterministic regression instead of a manual offline exercise, stop the reference web server, then run `npm run build` and `npm run test:e2e`. The six scenarios include actual offline catch-up, simultaneous generation requests, cross-tab sign-out, private byte access and cross-owner denial. Chrome is used locally; CI installs Chromium. Tokens/passwords are excluded from recorded Auth artifacts.

## Evidence and honest limits

The Phase 6 baseline passed 219 unit tests, 299 pgTAP assertions, six browser scenarios and eleven authenticated performance queries. These counts describe executed local tests, not a coverage percentage, hosted capacity or human security approval. Phase 7 records its own checks and any failures.

The important tradeoffs are explicit: correlated parent RLS is indexed; deep dashboard offsets motivate later cursor pagination; generation has manual lease recovery rather than a durable queue; Storage/database cleanup is not atomic; Realtime notifications are best-effort; the worker capability narrows elevation without a service-role app client. The app still needs runtime patching, abuse controls, reconciliation and hosted verification before a public launch.

This project supports an experienced consultant/program leader's transition into hands-on software/product work. It does not claim seven years of professional software engineering, a deployed production service, a completed independent audit or an accepted upstream contribution. Nine generic files were selectively reused with authorization; all other source and synthetic demonstration content here belong to the reference workflow.
