# Supabase AI Story Reference

A small reference application exploring secure story workflows with Supabase and Next.js.

[Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Database](docs/DATABASE.md) · [Phase status](docs/PHASE-1.md)

## Current scope

Phase 1 provides an isolated local database, migrations, synthetic fixtures, generated types, tests, and a minimal Next.js page. Selected generic components and tooling were reused from an existing application with the owner's authorization; see the [reuse manifest](docs/REUSE-MANIFEST.json).

User sign-in, owner-access policies, story CRUD, private uploads, generation jobs, Edge Functions, and private Realtime Broadcast are subsequent phases. There is no deployed public demo yet.

## Requirements

- Node.js 24 and npm.
- A running local Docker-compatible daemon, with capacity for an additional Supabase stack.
- Ports 3100 and 55320–55324 available.

The Supabase CLI is pinned in the development dependencies. A hosted Supabase account or paid AI key is not required for Phase 1.

## Local setup

```bash
npm ci
npm run local:check
npm run supabase:start
npm run db:reset
npm run db:types
npm run dev
```

Open http://127.0.0.1:3100. Studio is http://127.0.0.1:55323, and local mail is http://127.0.0.1:55324. The static Phase 1 page needs no `.env.local`; `.env.example` documents placeholders for Phase 2.

`db:reset` destroys and recreates **this reference project's local database**, including its seed data. It is intended for disposable development fixtures. The wrapper rejects linked projects and remote arguments. The seed identities are database fixtures, not working login accounts.

The local start script omits Realtime, Storage, image transformation, Edge Runtime, analytics, and pooling until their implementation phases. It keeps Studio and metadata services for MCP. It uses a dedicated network with loopback host bindings, and does not stop another stack to free ports.

A small project-scoped Docker adapter makes those bindings explicit and accommodates Studio's cold-start health check on this laptop. All health checks remain required, and actual bindings are verified after startup. See [ADR-008](docs/DECISIONS.md) before upgrading the pinned CLI.

On a memory-constrained machine, `npm run supabase:start:core` starts the database services without Studio. Database tests and type generation still work; Studio and MCP are unavailable in this mode. All started services must still pass health checks. To switch modes, stop this reference stack with `npm run supabase:stop`, then run the desired start command. The first image download can take several minutes and has a thirty-minute limit.

## Verify

```bash
npm run db:test
npm run db:lint
npm run db:types:check
npm run check
```

Database tests run against Supabase Postgres using pgTAP. Role tests exercise both actual grants and the separate RLS barrier. They do **not** establish owner-access behavior yet: all client access is intentionally denied in Phase 1.

After editing SQL, reset the local database, run the database suite, regenerate types, and review the resulting diff. Create new migration filenames with `npx supabase migration new <name>`; do not rename existing applied migrations. Migrations are the source of truth.

## Local MCP in Codex

This repository includes `.codex/config.toml`:

```toml
[mcp_servers.supabase_reference_local]
url = "http://127.0.0.1:55321/mcp"
```

That is TOML in a file, not a terminal command. Start this local stack first. Trust the project, then restart/reload MCP servers in Codex to discover tools. This endpoint connects to the local reference stack only. It does not configure access to a hosted project. The configuration contains no credentials.

The endpoint handshake and discovery of 11 tools passed during Phase 1. Loading those tools into a particular Codex desktop session is a separate client activation step.

Do not point it at another local stack or the commercial production project. Before exposing a service outside this machine, revisit authentication and access controls; local defaults are for development.

## Stop

```bash
npm run supabase:stop
```

This targets only `supabase-ai-story-reference` and retains local data. If Docker is unresponsive, inspect Docker Desktop before retrying; do not use a global prune/reset as a recovery shortcut.

## Development record

- [Decisions](docs/DECISIONS.md)
- [AI-assisted development](docs/AI-DEVELOPMENT.md)
- [Contribution notes](docs/CONTRIBUTION-NOTES.md)

This project supports an honest account of an experienced technical consultant and program leader developing hands-on software and product expertise. Validation claims are backed by the phase record.
