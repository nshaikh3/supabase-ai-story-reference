# Supabase AI Story Reference

A small reference application exploring secure story workflows with Supabase and Next.js.

[Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Database](docs/DATABASE.md) · [Phase status](docs/PHASE-3.md)

## Current scope

Phases 1–3 provide an isolated local database, migrations, synthetic fixtures, generated types, automated tests, and email/password authentication with owner access. Selected generic components and tooling were reused from an existing application with the owner's authorization; see the [reuse manifest](docs/REUSE-MANIFEST.json).

Sign-up, email confirmation, sign-in/out, password recovery and a protected account page are implemented. The owner dashboard, story editor, deletion and private hero-image uploads are implemented. Generation jobs, Edge Functions, and private Realtime Broadcast remain subsequent phases. There is no deployed public demo yet.

## Requirements

- Node.js 24 and npm.
- A running local Docker-compatible daemon, with capacity for an additional Supabase stack.
- Ports 3100 and 55320–55324 available.

The Supabase CLI is pinned in the development dependencies. A hosted Supabase account or paid AI key is not required for Phases 1–3.

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

The local start script omits Realtime, image transformation, Edge Runtime, analytics, and pooling until their implementation phases. Full mode keeps Studio and metadata services for MCP; the setup above uses core mode to reduce memory use. It uses a dedicated network with loopback host bindings, and does not stop another stack to free ports.

A small project-scoped Docker adapter makes those bindings explicit and accommodates Studio's cold-start health check on this laptop. All health checks remain required, and actual bindings are verified after startup. See [ADR-008](docs/DECISIONS.md) before upgrading the pinned CLI.

On a memory-constrained machine, `npm run supabase:start:core` starts the database services without Studio or postgres-meta. Database tests and type generation still work; Studio and MCP are unavailable in this mode. All started services must still pass health checks. To switch modes, stop this reference stack with `npm run supabase:stop`, then run the desired start command. The first image download can take several minutes and has a thirty-minute limit. Reference Storage startup waits up to five minutes for its actual health probe before the CLI performs its final stack checks. A stopped, OOM-killed, probe-less or persistently unhealthy service still fails startup.

## Verify

```bash
npm run db:test
npm run db:lint
npm run db:advisors
npm run db:types:check
npm run check
```

Database tests run against Supabase Postgres using pgTAP. Role tests exercise actual grants and the separate RLS barrier: owner CRUD, cross-user denial, protected columns, parent-derived child reads, anonymous denial and forbidden child writes. Pages remain read-only. Owners can reserve and remove hero-image metadata, with matching private Storage policies and deletion guards. Real Storage API checks are part of the browser suite.

After editing SQL, reset the local database, run the database suite, regenerate types, and review the resulting diff. Create new migration filenames with `npx supabase migration new <name>`; do not rename existing applied migrations. Migrations are the source of truth.

## Try authentication

1. Open http://127.0.0.1:3100/sign-up and create an account using a synthetic address such as `reader@example.test` and a password of at least 10 characters.
2. Open the local inbox at http://127.0.0.1:55324. Mail is captured here; it is not delivered to a real email account.
3. Follow the confirmation link in the same browser used to register. You will reach the protected account page.
4. Sign out and back in, or use **Forgot password?** to test recovery through the local inbox. Recovery links also need the initiating browser.

Seeded Alice/Bob identities are database test fixtures, not login accounts. New accounts correctly show zero stories. Choose **Open my stories**, then **New story** to create a draft. Every database reset deletes local login accounts and user-created data for this reference stack only.

## Try stories and private images

Create a story with a fictional hero name and prompt. Open the story to edit it or attach one synthetic hero illustration (PNG/JPEG/WebP, at most 2 MiB and 16 megapixels). Uploads become still WebP images up to 1600 pixels per side, with source metadata removed. Remove an existing image before replacing it. A failed upload keeps a removable reservation; use **Remove hero image**, then retry.

Images are served through an authenticated, uncached route, not a public URL. Story deletion requires the form's confirmation checkbox and removes objects before relational rows. Do not delete Storage object metadata through SQL: that does not remove bytes. Cross-service failures and concurrent direct uploads need the [cleanup review](docs/SECURITY.md#private-images-and-cleanup) before production use.

The dashboard displays 20 stories per page in a deterministic order. AI generation is not active yet; new stories stay in `draft`.

## Browser verification

```bash
npm run build
npm run test:e2e
```

Stop an existing reference web server on port 3100 first; Playwright starts and stops its own production server. Local tests use installed Google Chrome. CI installs Playwright Chromium. Tests use random synthetic credentials and their own local mailboxes; no service-role key or test-only authentication bypass exists. Auth traces, screenshots and videos are disabled to avoid retaining credentials. The story scenario writes two explicit desktop/mobile screenshots containing only its fictional story fixture to ignored test-results/. Reset the reference database after a test run to remove test identities.

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

## Development record

- [Phase 1 results](docs/PHASE-1.md), [Phase 2 results](docs/PHASE-2.md), and [Phase 3 results](docs/PHASE-3.md)
- [Decisions](docs/DECISIONS.md)
- [AI-assisted development](docs/AI-DEVELOPMENT.md)
- [Contribution notes](docs/CONTRIBUTION-NOTES.md)

This project supports an honest account of an experienced technical consultant and program leader developing hands-on software and product expertise. Validation claims are backed by the phase record.
