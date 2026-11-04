# Local development

How to run, test and explore the complete application on your own machine. The public site is a read-only showcase; Auth, private Storage, Edge generation and private Realtime run here and in CI. For a guided tour of what to look at, see the [reviewer guide](REVIEWER-GUIDE.md).

## Requirements

- Node.js 24 and npm.
- A running local Docker-compatible daemon, with capacity for an additional Supabase stack.
- Ports 3100, 55320–55324 and 55328 available.

The Supabase CLI is pinned in the development dependencies. A hosted Supabase account or paid AI key is not required for the default mock workflow.

## Local setup

```bash
npm ci
npm run local:check
npm run supabase:start:core
npm run local:env
npm run db:reset
npm run db:types
npm run dev
```

Open http://127.0.0.1:3100. Local mail is http://127.0.0.1:55324. Studio is http://127.0.0.1:55323 when using full mode (`npm run supabase:start`). `local:env` writes only the local public URL, publishable key and application URL to ignored `.env.local`. It never writes privileged keys and refuses to overwrite a differing file. Use `127.0.0.1` consistently so Auth cookies and redirects match.

`db:reset` destroys and recreates **this reference project's local database**, including its seed data. It is intended for disposable development fixtures. The wrapper rejects linked projects and remote arguments. The seed identities are database fixtures, not working login accounts.

Core mode includes eight services: database, API gateway, Auth, Data API, local mail, Storage, Edge Runtime and Realtime. Image transformation, analytics and pooling remain off. Full mode additionally keeps Studio and metadata services for MCP. The stack uses a dedicated network with loopback host bindings, and does not stop another stack to free ports.

A small project-scoped Docker adapter makes those bindings explicit and accommodates Studio's cold-start health check on this laptop. All health checks remain required, and actual bindings are verified after startup. See [ADR-008](DECISIONS.md) before upgrading the pinned CLI.

On a memory-constrained machine, `npm run supabase:start:core` starts the database services without Studio or postgres-meta. Database tests and type generation still work; Studio and MCP are unavailable in this mode. All started services must still pass health checks. To switch modes, stop this reference stack with `npm run supabase:stop`, then run the desired start command. The first image download can take several minutes and has a thirty-minute limit. Reference Storage and Realtime start/restart operations wait up to five minutes for their actual health probes before the CLI continues, including after database reset. A stopped, OOM-killed, probe-less or persistently unhealthy service still fails startup.

Local Edge Functions explicitly use the `oneshot` worker policy recommended for development. Each request gets its own worker; CPU and memory limits remain enforced. This avoids relying on the pinned CLI's different `per_worker` default, which produced cumulative CPU-limit shutdowns during local browser verification. Hosted worker reuse and capacity still require separate validation.

Startup captures and discards CLI output because it contains privileged local credentials. It prints fixed progress/status messages instead. On failure, inspect only reference-container health; do not publish raw startup/status output or enable unreviewed debug logging.

## Read-only showcase without Docker

```bash
npm run build:showcase
npm run test:showcase
npm run preview:showcase
```

Open `http://127.0.0.1:3101`. The separate public build reuses the sample and architecture pages, with no sign-in, database, Server Actions or backend credentials. I chose this read-only deployment on my existing Vercel Pro team and kept the complete application local. See [the showcase runbook](SHOWCASE.md). Verify the published static site with `npm run test:showcase:live`; this separate command is pinned to the reference demo origin and does not start or modify the local backend.

## Verify

```bash
npm run db:test
npm run db:lint
npm run db:advisors
npm run db:types:check
npm run check
npm run db:performance
npm audit --omit=dev --audit-level=high
```

Database tests run against Supabase Postgres using pgTAP. Role tests exercise actual grants and the separate RLS barrier: owner CRUD, cross-user denial, protected columns, parent-derived child reads, anonymous denial and forbidden child writes. Pages remain read-only. Owners can reserve and remove hero-image metadata, with matching private Storage policies and deletion guards. Real Storage API checks are part of the browser suite.

`db:performance` uses fixed synthetic fixtures inside a rolled-back transaction and checks actual non-bypass `authenticated` visibility. It writes full plans to ignored `test-results/database-performance.json`; do not run it concurrently with browser tests or user work. See [measurement limits and results](PERFORMANCE.md). Full `npm audit` currently reports one moderate development-only `minimatch` advisory in the ESLint toolchain, documented in the [audit](SECURITY-AUDIT.md#dependency-follow-up-november-2); the production-only check does not cover development dependencies.

`npm run check` includes `npm run docs:check`, unit tests, TypeScript, lint and production build. The documentation check validates repository Markdown links/anchors and documented npm commands offline; it does not validate external sites or prove deployment readiness. CI runs the same local workflow in [.github/workflows/ci.yml](../.github/workflows/ci.yml). Every push runs both the reference and showcase jobs; see [recent runs](https://github.com/nshaikh3/supabase-ai-story-reference/actions/workflows/ci.yml) and the dated [publication evidence](record/PUBLICATION.md).

After editing SQL, reset the local database, run the database suite, regenerate types, and review the resulting diff. Create new migration filenames with `npx supabase migration new <name>`; do not rename existing applied migrations. Migrations are the source of truth.

## Try authentication

1. Open http://127.0.0.1:3100/sign-up and create an account using a synthetic address such as `reader@example.test` and a password of at least 10 characters.
2. Open the local inbox at http://127.0.0.1:55324. Mail is captured here; it is not delivered to a real email account.
3. Follow the confirmation link in the same browser used to register. You will reach the protected account page.
4. Sign out and back in, or use **Forgot password?** to test recovery through the local inbox. Recovery links also need the initiating browser.

Seeded Alice/Bob identities are database test fixtures, not login accounts. New accounts correctly show zero stories. Choose **Open my stories**, then **New story** to create a draft. Every database reset deletes local login accounts and user-created data for this reference stack only.

## Try stories and private images

Create a story with a fictional hero name and prompt. Open the story to edit it or attach one synthetic hero illustration (PNG/JPEG/WebP, at most 2 MiB and 16 megapixels). Uploads become still WebP images up to 1600 pixels per side, with source metadata removed. Remove an existing image before replacing it. A failed upload keeps a removable reservation; use **Remove hero image**, then retry.

Images are served through an authenticated, uncached route, not a public URL. Story deletion requires the form's confirmation checkbox and removes objects before relational rows. Do not delete Storage object metadata through SQL: that does not remove bytes. Cross-service failures and concurrent direct uploads need the [cleanup review](SECURITY.md#private-images-and-cleanup) before production use.

The dashboard displays 20 stories per page in a deterministic order. New stories start in `draft`. Save edits, then choose **Generate story** to produce five pages. Details lock during generation and after completion. Failed stories can be edited and retried, up to three attempts. Open story tabs update automatically through private Broadcast. Reconnecting or returning to a tab reloads authorized database state; **Refresh status** remains a fallback while disconnected. Interrupted runs can be resumed after two minutes. There is no periodic polling.

To try live updates, open the same story in two tabs, wait for **Live updates connected**, then generate in one tab. Both show the saved pages. Signing out also closes other open story tabs' subscriptions and removes their private content.

## Generation configuration

Startup creates ignored `supabase/functions/.env` with `AI_PROVIDER=mock` and a random worker capability (mode 0600). Database reset provisions only its hash in the private schema. After applying migrations without a reset, run `npm run generation:setup`. Keep this file secret: it is separate from the public Next.js `.env.local`. No service-role application client is used.

Mock mode is free and makes no AI network calls. To deliberately enable Gemini, edit the Edge environment file, preserving `GENERATION_WORKER_SECRET`, and set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL` to a currently available generateContent model supporting structured JSON. Then restart **only this reference stack**. Never put the AI key or worker secret in `NEXT_PUBLIC_*` variables. The optional provider sends title, fictional hero name and idea to Google; it does not receive images. Tests refuse to call a paid provider. Live Gemini validation requires your own optional key and is not part of the mock acceptance gate.

The Edge Function authenticates independently of the gateway and uses the caller's RLS context. Narrow lifecycle RPCs require the worker capability as well as owner identity. Database completion is atomic; provider calls and network delivery are not. A lost response should be followed by a status refresh before retrying. The local three-attempt cap does not replace production rate limiting. See [ADR-014–016](DECISIONS.md).

## Browser verification

```bash
npm run build
npm run test:e2e
```

Stop an existing reference web server on port 3100 first; Playwright starts and stops its own production server. Local tests use installed Google Chrome. CI installs Playwright Chromium. Tests use random synthetic credentials and their own local mailboxes; no service-role key or test-only authentication bypass exists. Auth traces, screenshots and videos are disabled to avoid retaining credentials. Story and generation scenarios write explicit desktop/mobile screenshots containing only its fictional story fixture to ignored test-results/. Reset the reference database after a test run to remove test identities.

## Local MCP in Codex

This repository includes `.codex/config.toml`:

```toml
[mcp_servers.supabase_reference_local]
url = "http://127.0.0.1:55321/mcp"
```

That is TOML in a file, not a terminal command. Start full mode (`npm run supabase:start`) first; core mode omits this endpoint. Trust the project, then restart/reload MCP servers in Codex to discover tools. This endpoint connects to the local reference stack only. It does not configure access to a hosted project. The configuration contains no credentials.

The endpoint handshake and discovery of 11 tools passed during Phase 1. Loading those tools into a particular Codex desktop session is a separate client activation step.

Do not point it at another local stack or the commercial production project. Before exposing a service outside this machine, revisit authentication and access controls; local defaults are for development.

## Stop

```bash
npm run supabase:stop
```

This targets only `supabase-ai-story-reference` and retains local data. If Docker is unresponsive, inspect Docker Desktop before retrying; do not use a global prune/reset as a recovery shortcut.
