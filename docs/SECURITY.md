# Security model

## Phase 1 boundary

The application is a static page. There are no authenticated application features yet. Every application table in `public` has RLS enabled, no permissive policies, and no table grants to `PUBLIC`, `anon`, or `authenticated`. API auto-exposure is disabled in local configuration. Migrations also revoke privileges explicitly so local configuration is not the only protection.

The database owner can administer and seed tables; that is not proof of user authorization. Tests switch to actual API roles and set synthetic request claims. Separate assertions check grants, then temporary test-only grants allow the suite to exercise RLS itself. All test changes roll back.

## Ownership and future surfaces

| Resource | Intended authority | Current access |
| --- | --- | --- |
| Stories | Direct `owner_id` | All client access denied |
| Pages | Parent story | All client access denied |
| Asset metadata | Parent story | All client access denied |
| Storage objects | Owner and story namespace | Not implemented |
| Realtime topics | Story ownership | Not implemented |
| Generation jobs | Parent story and controlled lifecycle | Not implemented |

An `owner_id` default is convenience, not authorization. Phase 2 must check both existing and resulting ownership, prevent ownership transfer, and constrain writable columns. RLS is row security; it does not by itself prevent clients from forging generation status.

The only custom function is an invoker timestamp trigger in non-exposed `private`, with an empty search path and no client execute grants. There are no exposed views or definer functions.

## Local tooling

The local wrappers validate the project ID, ports, exposed schema, and grant setting; reject linked projects and all extra arguments; strip hosted Supabase and Postgres credentials; and require a local Docker socket. A Docker adapter applies explicit `127.0.0.1` mappings only to this project's named service containers and rejects unexpected port mappings. It does not alter Docker's global configuration or print secret environment values. Start verifies actual runtime network and port bindings; an unexpected binding causes the reference containers to be stopped while retaining their volumes. These guardrails prevent routine targeting mistakes; a developer with Docker or database-admin access remains trusted.

Studio still has to pass its real HTTP health probe. Its deadline and startup grace period accommodate cold starts on this laptop; health checks are not skipped. The optional core mode omits Studio entirely, so MCP is unavailable in that mode.

MCP is privileged local development tooling, not a user-facing feature. A local MCP connection is not evidence of end-user authorization. No production or hosted account is connected by this repository.

## Data and secrets

Fixtures use synthetic identities and fictional names. They contain no login passwords. No production environment files, private prompts, customer data, payment code, premium-generation features, or commercial assets were copied. The original private planning brief is ignored by Git.

Never log access tokens, keys, emails, fictional/child names, full prompts, or generated outputs. Later operational logs should use story/job identifiers, operation, duration, and safe error codes. `.env.example` has placeholders only. Any future privileged key is server-only and must never be prefixed with `NEXT_PUBLIC_`.

## Pending verification

The Phase 6 security audit is still pending. Phase 1 tests establish denial and data integrity only. Cross-user allowed/denied CRUD, Auth session behavior, uploads, jobs, and private channel authorization remain required gates in their respective phases.
