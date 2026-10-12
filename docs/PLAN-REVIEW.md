# Original plan review and application readiness

Reviewed October 7, 2026 against implementation commit `c0fe1ea`, the original 2,449-line `Supabase_Job_Application_Reference_Project_Codex_Plan.md`, and the pasted lead-engineer request. The original brief is retained locally, outside the public source inventory. The earlier local-only instruction was superseded by authorization to publish under `nshaikh3`, using MIT and free-tier resources. On October 8, after Supabase rejected creation at the account's free-project limit, the user selected a public read-only demo and retained the full application locally. On October 11, the user approved hosting the showcase on the existing Vercel Pro plan without upgrades or add-ons.

## Verdict

The core engineering requirements have a passing local checkpoint. **The entire original definition of done is not yet met.** The initial review found the required anonymous `/demo` route missing (HTTP 404). That omission has now been corrected with a five-page sample, architecture tour and landing links. A separate static showcase reuses those components without importing the private application's routes or backend configuration. Its current validation and publication status are in [PUBLICATION.md](PUBLICATION.md).

The [public MIT repository](https://github.com/nshaikh3/supabase-ai-story-reference), successful Linux CI and [live HTTPS showcase](https://supabase-ai-story-reference.vercel.app) are verified. Anonymous desktop/mobile production acceptance passed on October 11. Hosted full-application deployment is now explicitly deferred. The earlier claim that all local work was complete was too broad; historical test evidence remains valid for the code checkpoint it describes.

The project can already support a local interview walkthrough, recorded demonstration and discussion of engineering decisions. The self-service source/demo links are ready to share; personal review and a narrated walkthrough remain below. This review does not certify security, production readiness, candidate expertise or a hiring outcome.

## Requirements matrix

| Original requirement | Assessment | Evidence / remaining acceptance |
| --- | --- | --- |
| Separate reference project; no commercial data, assets or privileged application client (§8) | Implemented within the revised reuse scope | [Reuse manifest](REUSE-MANIFEST.json), [AI provenance](AI-DEVELOPMENT.md), [security model](SECURITY.md). Nine authorized generic source/target hashes matched October 7. No commercial project was connected. |
| Next.js application, email Auth, SSR sessions and owner story UI (§11, §17–18) | Implemented; locally verified | [README](../README.md), [browser scenarios](../tests/e2e/auth.spec.mts). Includes confirmation, recovery, dashboard, editing, deletion and pagination. |
| Relational schema, migrations, explicit grants, RLS and owner/cross-owner/anonymous tests (§13–16, §34) | Implemented; locally verified | [Database inventory](DATABASE.md), [migrations](../supabase/migrations), [database tests](../supabase/tests/database). Seven versioned migrations; parent-derived child ownership. |
| Private Storage and authenticated images (§28–29) | Implemented; locally verified | [Private byte route](../src/app/assets/[id]/route.ts), [security model](SECURITY.md), browser owner/isolation/recovery checks. Cleanup tooling is implemented; a live aged-orphan deletion remains unexercised. |
| Generation jobs, authenticated Edge execution, five-page output and retry/failure handling (§19–25) | Implemented; locally verified | [Edge handler](../supabase/functions/generate-story/handler.ts), [decisions](DECISIONS.md). Persisted job lifecycle and manual lease recovery; not a durable background queue or automatic retry service. |
| Mock provider and optional real AI integration (§20–24) | Implemented; mock verified | [Generator](../supabase/functions/_shared/generator.ts). Gemini adapter exists and has validation tests; no live paid-provider result is claimed. Paid AI is unnecessary for the initial reference demonstration. |
| Private Realtime Broadcast, authorization and reconnect behavior (§26–27) | Implemented; locally verified | [Realtime migration](../supabase/migrations/20260930142245_add_private_generation_broadcast.sql), [client lifecycle](../src/lib/stories/realtime.ts), browser reconnect/logout checks. Broadcast is a best-effort notification, with authorized state refetch. |
| Generated types, synthetic fixtures, safe errors/logging (§32–35) | Implemented; reviewed locally | [Database documentation](DATABASE.md), [security model](SECURITY.md), [execution evidence](LOCAL-HARDENING.md). These are scoped review findings, not a guarantee about all possible future logs or data. |
| Public read-only `/demo` and landing page links (§30–31) | Implemented and publicly verified | Account-free fictional five-page sample, architecture tour and working GitHub link. Anonymous production checks passed chapters, mobile, CSP, reload, private-route denial and rejected writes. |
| README, architecture/database/security documentation, decisions, AI provenance and screenshots (§36–43) | Present; reviewer status corrected by this review | [Reviewer guide](REVIEWER-GUIDE.md), [architecture](ARCHITECTURE.md), [decisions](DECISIONS.md), [AI provenance](AI-DEVELOPMENT.md). Final human security-sensitive review remains pending. |
| Security audit and performance review (§45–46) | Executed locally, with limitations recorded | [Audit](SECURITY-AUDIT.md), [performance](PERFORMANCE.md), [latest execution record](LOCAL-HARDENING.md). Not an independent penetration test, production load test or human release sign-off. |
| No committed secrets (§8, §54) | Scoped scans passed; publication review remains | October 7 source/browser scans found no active worker or local privileged credentials/private-key markers. Gitleaks subsequently scanned all 15 existing commits and a source-only snapshot without findings. Rescan final changes before publication; see [publication evidence](PUBLICATION.md). |
| Reproducible setup, fresh-install and CI evidence (§34, §53) | Local and independent Linux runner passed | [CI run 37883626288](https://github.com/nshaikh3/supabase-ai-story-reference/actions/runs/37883626288) passed both jobs on commit `280eb1e`, including fresh installation, reset, tests and production build. |
| Public GitHub repository, license/polish and live HTTPS demo (§5, §44, §49, §54) | **Public source and live read-only demo achieved** | [MIT source](https://github.com/nshaikh3/supabase-ai-story-reference) and [production demo](https://supabase-ai-story-reference.vercel.app) verified. Full hosted app deferred by the user; its [deployment gates](DEPLOYMENT.md) remain open. |
| Legitimate contribution candidate (§50–52, §54) | Documented | [Contribution notes](CONTRIBUTION-NOTES.md) contain reproducible project observations. No issue or PR has been submitted or accepted. Revalidate current upstream behavior before proposing one; submission is conditional, not a fabricated completion requirement. |
| User-facing MCP extension (§47, §54) | Optional; evaluated and deferred | [MCP evaluation](MCP-EVALUATION.md). V1 does not require it. Local development MCP is a separate capability and was verified in Phase 1. |

The brief's theme picker and intermediate progress labels are suggested UI details, rather than independent acceptance gates. The current UI uses a freeform idea and persisted job states. It should not claim to implement a preset theme picker. The different source-directory layout and reservation-before-upload flow are documented implementation choices, not evidence of missing tenancy or Storage functionality.

## Evidence available now

The latest full execution is the October 9 Linux CI run in [PUBLICATION.md](PUBLICATION.md); earlier local commands and limits remain in [LOCAL-HARDENING.md](LOCAL-HARDENING.md):

- 308 unit tests across 25 files, 356 pgTAP assertions across eight files and eight passing browser scenarios; the final browser run had zero retries.
- Application type checking, lint, documentation validation and production build; database reset, lint and generated-type comparison.
- Eleven authenticated performance queries with rollback, plus a four-transaction quota-boundary check: one admission, three denials, no overshoot. Neither is a production capacity claim.
- Local pause/resume, maintenance, worker rotation and a reviewed empty cleanup execution. Positive cleanup/race behavior has unit/SQL coverage; no live old orphan was available for deletion.
- Production dependency audit reported zero advisories. The full audit reported five high package entries from one unpatched development-only `braces` advisory. This is not a clean full audit or an approved exception.

One earlier sign-in redirect failure did not recur in the final focused/full browser runs; diagnostics were added, but its cause was not established. A nonfatal Next destination-stream diagnostic was also recorded. Preserve those limits when presenting reliability evidence.

The original October 7 plan review inspected documents, routes, repository/publication state and the local `/demo` response. It did not itself rerun the full suites or perform an independent security audit. At that checkpoint, after the documentation corrections, `npm run docs:check` passed for 23 Markdown files, 167 local links and documented npm commands; `git diff --check` passed. Those checks are separate from the execution results above.

## Handoff and remaining work

### 1. Personally exercise and explain the reference

Use the [reviewer walkthrough](REVIEWER-GUIDE.md): register a fictional local identity, confirm through the local inbox in the same browser, create and generate a story, observe a second tab, test a second account's denial, and remove the synthetic content afterward. Seed identities are SQL fixtures, not usable accounts. Do not reset the database while preserving a demonstration account or recording.

Be able to explain parent-derived RLS, caller JWT versus worker capability, private object access, Broadcast as an invalidation hint, lost-response/manual recovery behavior, quota enforcement, and why mock AI is the default. Record what you personally reviewed in [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md); do not mark security-sensitive review complete merely because tests pass.

### 2. Presentation acceptance — completed

The `/demo`, architecture tour and landing links are implemented with bundled fictional content. Shared components serve both the local full app and the separate public showcase. Real source and live URLs are now verified; [PUBLICATION.md](PUBLICATION.md) records static-build and anonymous production browser acceptance.

Acceptance: an anonymous desktop/mobile visitor can understand the application and view the story; the page distinguishes sample content from a live private session; existing owner-only paths and tests remain intact; the application checks/build and relevant browser checks pass. This task does not require hosted credentials or a paid AI key.

### 3. Source publication and CI — completed

The user created `nshaikh3/supabase-ai-story-reference` with MIT. The implementation was pushed on October 9 after a final history scan, preserving the user-created initial license commit. GitHub CI exposed missing optional dependency metadata in the lockfile; the repair subsequently passed both Linux CI jobs. The exact run and commit are recorded in [PUBLICATION.md](PUBLICATION.md). Review the complete Git history and tracked assets for secrets, personal information and unintended commercial material. Keep the local planning brief and environment files out of the public repository unless deliberately reviewed for publication.

Publication preserved the phase history and user-created MIT license. The public source, independent Linux CI and source-only checks are verified. Rescan future changes before pushing and retain exact commit/run evidence.

### 4. Static showcase — published; full-app hosting — deferred

The static showcase described in [SHOWCASE.md](SHOWCASE.md) is [live](https://supabase-ai-story-reference.vercel.app) on the existing Vercel Pro team; no plan upgrade or add-on was added. It needs no Supabase capacity, SMTP, worker secret or paid provider. The full account-based app remains local by user choice. Its later hosting would still follow [DEPLOYMENT.md](DEPLOYMENT.md) and [OPERATIONS.md](OPERATIONS.md). Supply the reference-only hosting accounts/project choices, region, exact origins, SMTP sender, spending ceiling and release owner. Credentials belong in platform secret stores, not in chat, source or documentation. Do not reuse the commercial project's resources or link the guarded local checkout to a hosted target.

Begin with mock generation and invited test accounts. A public read-only demo can remain accessible while the working account-based app stays invitation-only. Apply migrations through the release workflow without local SQL seed identities; provision fresh worker material; configure platform traffic/spending controls; exercise HTTPS Auth, private Storage, Edge authorization, Realtime, native image processing, cleanup and recovery on staging. Recheck the development advisory and record a patch or independent, time-bounded exception if still unresolved. Complete human release review before promoting a stable public URL.

The official [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) is a release reference alongside this repository's stricter target-specific gates. Local success does not prove real SMTP, hosted JWT compatibility, alert delivery or backup restoration.

### 5. Package evidence for a recruiter

Prepare a two-to-three-minute recording showing the purpose, a completed story, two-tab updates and one owner-isolation example. The [case study](CASE-STUDY.md) now covers the problem, scope, key decisions, one failure investigated, verification results and known limitations. The verified public demo, repository, reviewer guide and architecture are linked above. Keep a recording as a fallback for a live service interruption.

Use truthful language such as: “Developed an AI-assisted Supabase reference application demonstrating owner-isolated data, private files and authenticated generation, with 308 unit tests, 356 SQL assertions and eight browser scenarios passing on an independent Linux CI runner.” Date the evidence and update the numbers if the code changes. Do not describe the deterministic mock as live paid AI, the app as a production customer deployment, the review as an independent audit, or an unsubmitted candidate as an accepted contribution.

### 6. Tailor the application to a current role

The original plan's role list is a historical starting point. On October 7, the fresh [Supabase careers page](https://supabase.com/careers) listed Customer Solution Architect (AMER) and Product Manager — Auth; the earlier Marketplace PM and Founding TPM titles were not listed on that page. This review did not establish the full requirements or your eligibility for any individual vacancy. Recheck the actual posting and location requirements before applying, especially against the relocation plans in the original brief.

For solutions work, emphasize SQL/RLS diagnosis, explaining tradeoffs and helping another person reproduce the setup. For technical program work, emphasize phased execution, dependencies, risks, failure evidence and release gates. For product work, explain the intended reviewer, why account-free evaluation matters, what was intentionally excluded and how documentation friction informed priorities. Connect these to your actual consulting/program experience without relabeling it as years of professional software engineering.

### 7. Consider an upstream contribution after the core presentation is ready

Choose one concrete observation from [CONTRIBUTION-NOTES.md](CONTRIBUTION-NOTES.md), check the current official documentation and existing issues, and reproduce it in a minimal example against a supported version. A precise documentation clarification may be more useful than a feature PR. Several recorded failures were project assumptions or local resource issues, so attribution must remain careful. Submission needs explicit authorization; none has been sent.

## Remaining user involvement

Repository creation, integration access, source publication, Linux CI and the read-only Vercel production release are complete. No further account setup is needed to share these links. The existing Pro plan is used without upgrades or add-ons. No existing hosted project was paused, deleted or reused.

Personal walkthrough, job-role selection, security-sensitive human review and any upstream submission remain human decisions. Full hosted application gates remain open but are outside the currently selected static-demo release scope.
