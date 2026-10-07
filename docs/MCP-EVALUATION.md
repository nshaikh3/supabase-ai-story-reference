# Optional Phase 8: user-facing MCP evaluation

Decision: retain the working browser product and defer a user-facing MCP interface. The reference already demonstrates Auth, RLS, Storage, Edge execution, Broadcast and verified resource admission. No concrete user requirement currently needs an external agent to read stories or request generation. Adding an OAuth consent surface and another content/operation entry point would enlarge the review and support burden without demonstrating a needed workflow.

This is an evaluated scope decision, not an implemented MCP feature. The privileged Supabase development MCP endpoint is separate tooling and must never become an end-user endpoint or supply application credentials.

If a future user asks for agent access, begin with a read-only tool returning a bounded list of the authenticated user's stories. Use Supabase Auth's OAuth 2.1 authorization, protected-resource discovery, explicit user consent, audience/token validation and the caller's JWT under the existing RLS policies. Do not pass a service-role client to tools. Review OAuth client registration/redirects, scopes, revocation and JWT lifetime, origin handling, prompt injection, content disclosure and per-tool rate limits. Any generation tool must reuse database admission and require explicit user intent before spending resources. Storage paths, worker capabilities and operator operations must remain outside the tool surface.

Accept only after the same anonymous/cross-owner/direct-call regressions, consent/revocation checks, quota tests and human review pass for that concrete interface. No OAuth server setting or hosted resource was enabled during this evaluation.

Sources reviewed October 6: [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [deploying an authenticated MCP server](https://supabase.com/docs/guides/ai-tools/byo-mcp). The recommendation above is a project scope/security judgment, not a provider requirement.
