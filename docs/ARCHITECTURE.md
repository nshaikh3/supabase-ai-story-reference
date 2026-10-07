# Architecture

## System and trust boundaries

```mermaid
flowchart LR
  Browser[Browser: public key and user session] --> Next[Next.js: verified user and private responses]
  Next --> Auth[Supabase Auth and PKCE]
  Next -->|User JWT| API[Data API and RLS]
  Next -->|User JWT| Storage[Private Storage]
  Storage -->|Bytes| Next
  Next -->|User JWT| Edge[generate-story Edge Function]
  Edge -->|Verify token| Auth
  Edge -->|User JWT and narrow worker capability| RPC[Controlled lifecycle RPCs]
  Edge --> Mock[Default deterministic mock]
  Edge -.->|Optional text-only request| Gemini[Gemini provider]
  API --> DB[(Postgres: stories and children)]
  RPC --> DB
  DB -->|Minimal private status hints| Broadcast[Realtime Broadcast]
  Browser -->|JWT and owned story topic| Broadcast
  Broadcast --> Browser
  Operator[Privileged local operator and CI] -.->|Migrations and fixture setup| DB
```

All HTML, including the landing page, renders dynamically to receive a fresh CSP nonce and private/no-store policy. Image responses are dynamic too. Server Actions handle validated credentials; request-scoped SSR clients persist cookie sessions. Proxy verifies claims, refreshes cookies and prevents shared caching. Protected pages, mutation actions and the image route independently verify the current user with Auth before accessing data. No privileged credential is part of the application data path.

RLS derives ownership through `auth.users -> stories -> story_pages/assets/generation_jobs`. Stories allow owner CRUD on their editable details; column grants reserve ownership and generated fields for server workflows. Pages are readable by the owner, with direct writes denied. Owners can reserve/delete immutable hero-image metadata. Story deletion removes Storage objects before cascading relational rows; a trigger blocks metadata deletion if a committed object still exists.

Local development uses its own project ID, loopback network and ports. Studio/metadata provide optional local MCP inspection; reduced core mode omits Studio, postgres-meta and MCP. CLI/admin migration and test setup is separate from application requests.

| Surface | Identity / authority | Boundary |
| --- | --- | --- |
| Landing page, Auth screens | Public | No private story data; submitted credentials are validated and never logged |
| Workspace, Server Actions, private images | Verified user cookie session | Auth checks plus caller-context RLS; no service-role client |
| Direct Data API and Storage | Publishable key plus user JWT | UI restrictions are not authority; database grants/policies still apply |
| Edge generation | Verified bearer JWT plus Edge-held capability on claim/finish | Only controlled writes for that user's story; provider cannot choose permissions |
| Realtime channel | Current user JWT, owned canonical topic | Receive-only private notifications; events never replace an authorized database read |
| CLI, migrations, pgTAP fixtures, local MCP | Privileged developer control plane | Exact reference target; synthetic fixtures; never a customer-facing endpoint |

## Story and image workflow

`/dashboard` lists owner stories in pages of 20 with stable creation-time/ID ordering. `/stories/new` and `/stories/[id]` share a validated details form. Status stays server-managed. Generated pages render as escaped plain text. The detail view loads assets, pages and the bounded job history concurrently after verifying the parent.

Server Actions accept bounded input, obtain a verified user and pass that user's JWT to PostgREST/Storage. Image uploads are checked before database reservation: format, decoded pixels, dimensions, size and metadata. A reservation is inserted first, then bytes go to its random immutable owner/story path. One partial unique index allows one hero per story. The private image route repeats ownership and byte validation before returning WebP with `no-store` and `nosniff`; it bypasses Next's shared image optimizer.

Storage and Postgres are separate services. Upload failure retains a removable reservation. Removal calls the Storage API first; failure retains the rows. The guard inspects committed Storage metadata, including during parent cascades. This is retryable cleanup, not a distributed transaction; concurrent/ambiguous uploads still require the production reconciliation design in SECURITY.md. No custom columns, foreign keys or triggers are added to Supabase's managed Storage tables.

## Generation flow

A Server Action authenticates the user and calls the owner enqueue RPC before invoking `generate-story`. The Edge Function independently verifies the JWT, loads the story under caller RLS and idempotently reuses/enqueues the job. It adds its private worker header only to lifecycle RPC requests on the same user-scoped client, claims the job, re-reads frozen input, generates/validates five pages and invokes atomic completion. The browser receives refreshed owner data through the action and Phase 5 private Broadcast notifications.

The worker capability is not a Supabase service-role credential. It unlocks only narrow lifecycle SQL paths, each still requiring the story owner's authenticated identity. Elevated code lives in the unexposed private schema. Local provisioning persists only the secret hash in Postgres and keeps the raw secret in the Edge environment. No Next.js process or browser needs it.

Provider selection is deployment configuration. Mock is deterministic and has no network access. The optional Gemini adapter uses a fixed endpoint and explicit model, sends only story text fields, bounds time/bytes and validates output. Provider text is always data. A two-minute lease and three-attempt cap make interrupted work recoverable without automatic expensive retries. There is no durable background consumer, periodic polling or hosted deployment.

```mermaid
sequenceDiagram
  actor Owner
  participant Next as Next.js action
  participant DB as Postgres RPCs
  participant Edge as Edge handler
  participant Provider as Mock or Gemini
  participant Live as Private Broadcast
  Owner->>Next: Generate owned story
  Next->>DB: Enqueue with caller JWT
  DB-->>Live: Queued hint after commit
  Next->>Edge: Story ID and caller JWT
  Edge->>Edge: Verify user through Auth
  Edge->>DB: Claim with caller JWT and worker capability
  DB-->>Live: Generating hint
  Edge->>DB: Read frozen story input
  Edge->>Provider: Bounded text generation
  Provider-->>Edge: Untrusted structured output
  Edge->>DB: Validate and atomically finish five pages
  DB-->>Live: Complete hint
  Live-->>Owner: Invalidate displayed state
  Owner->>Next: Refresh authorized story data
```

The Server Action waits for Edge execution. The persisted job lifecycle and live hints make progress observable across tabs, but there is no durable asynchronous worker queue. A transport failure can leave work committed; refresh before retrying. An interrupted job expires and can be retried explicitly, within the attempt cap. Database completion is atomic; provider delivery and Storage cleanup are not.

## Private live updates

An invoker trigger on job INSERT and actual status changes calls `realtime.send` with `private=true`, event `generation_status` and topic `story:<uuid>`. Payloads contain only story/job identifiers, status and the message ID added by Realtime. Job/notification writes share the transaction. No job content, prompts, errors or pages enter Broadcast. The managed helper is best-effort and may warn instead of failing generation if notification insertion fails; the database remains authoritative.

The managed `realtime.messages` SELECT policy permits authenticated Broadcast reception only for an owned parent, exact canonical topic and matching row topic. No client INSERT/Presence policy exists. The policy does not filter the stored private flag because the managed authorization probe inserts only topic/extension; both the producer and channel explicitly select private transport. The policy uses the story primary-key and owner indexes; topic parsing rejects malformed identifiers without raising casting errors. Application tables are not added to a Postgres Changes publication.

The cookie-compatible browser client sends the user's current JWT before subscribing. Each valid event and each successful join/rejoin schedules a coalesced Server Component refresh. That refresh verifies the user and queries under RLS, preventing stale/out-of-order notifications from becoming display authority. Online/visibility events recheck the local session and recover current state without an interval. The SDK handles socket reconnects; route teardown/offline/session changes remove channels and cancel scheduled work. Sign-out uses browser Auth to notify other tabs, then a fixed full navigation clears cached private content. The existing Server Action remains a no-JavaScript fallback.

Authorization is checked on join/token refresh and cached by Realtime, not re-evaluated for each message. Story ownership is immutable here; deletion prevents subsequent generation and denies new joins. Revocation/transfer in a future product must account for that cache and JWT expiry. A public channel with the same name cannot receive private events. Hosted deployment should also disable public channel access globally.

## Deployment boundary and observability

The proposed Vercel/Supabase topology has three independent lifecycles: Next.js build/deployment, versioned database migrations, and Edge code/secrets. No one rollback undoes all three. Browser public environment variables are build-time values; operator credentials and worker/provider secrets never enter that build. Staging and production must have separate approved targets and secrets. Application configuration now validates explicit targets in the reviewed manifest, whose hosted entries remain null. Local scripts stay loopback-only; staging has a separate guarded harness. [DEPLOYMENT.md](DEPLOYMENT.md) lists the external operations and evidence still required before hosting.

Use identifiers, durations, state transitions and safe error codes for operational evidence. Do not log credentials, headers, emails, prompts, names or generated pages. Reference tests and [query-plan evidence](PERFORMANCE.md) measure local behavior; hosted monitoring, restore testing and load/cost alerts remain planned.

## Resource admission and recovery

Private controls serialize short admission transactions. Trigger enforcement covers direct story/asset/job writes; invoker image RPCs enter owner-checked private helpers. UTC-window counters survive resource deletion, and execution leases survive story cascades so deleted work cannot immediately replenish concurrency. Expired counters/leases are removed by a protected maintenance command. A fixed operator can pause new work while reads/deletion/in-flight completion remain available.

Each asset INSERT claims a once-only path registry entry; deletion retires it. Cleanup races through the same unique registry before rechecking old orphan identity and deleting bytes through Storage APIs. Managed metadata remains read-only to cleanup. App image decoding also acquires a bounded lease and network deadline. See [OPERATIONS.md](OPERATIONS.md) for concrete limits and failure recovery.

Nonce CSP requires dynamic rendering of every document, including the landing page. All document responses are private/no-store; the nonce is passed through request headers for Next SSR and independently returned in the response policy. The tradeoff is no static HTML/CDN cache for this small reference. Static scripts/styles can still be cached.
