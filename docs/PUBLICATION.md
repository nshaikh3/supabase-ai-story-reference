# Recruiter demo and publication execution

## Scope and authorization

On October 7, 2026, the user expanded the earlier local-only scope to include the missing demo page, a public GitHub repository, a live deployment and the remaining achievable portfolio deliverables. Publication and deployment are now authorized. The user selected `nshaikh3` as the intended owner, the MIT license and **free-tier resources only, with no paid upgrades**. GitHub authentication confirmed `nshaikh3`; Supabase organization EnKay was selected. The user subsequently chose to publish only the read-only showcase and retain the full app locally after free Supabase project creation was refused. Vercel plugin team access was restored on October 9. On October 11, the user explicitly approved using that existing Pro plan only. No upgrades or add-ons are authorized; credentials are not requested in chat.

The commercial application's services remain excluded. Local wrappers retain their local-only protections. Human review and personal interview understanding cannot be supplied or attested by an automated implementation run.

## Work and evidence

| Item | Current state |
| --- | --- |
| `/demo` and `/architecture` | Implemented. Final patched (Next.js 16.3.8) application check passed 308 unit tests, types, lint and production build. The initial full-app demo browser scenario passed desktop/mobile. |
| Landing-page navigation | Demo/architecture links implemented. GitHub link appears when a real repository URL is configured. |
| Public links | [Public repository](https://github.com/nshaikh3/supabase-ai-story-reference) verified and source uploaded. The [publication manifest](../deployment/publication.json) records that real URL; the live demo URL remains null. |
| Case study | [Draft completed](CASE-STUDY.md); publication/verification claims remain scoped to actual evidence. |
| Vercel configuration | A separate Next.js static showcase and Vercel Build Output package are implemented. No backend configuration, private routes or Server Actions enter that deployment. Packaging and the isolated browser scenario passed: all chapters, CSP, mobile, reload, no external requests, private-route 404s and POST denial. No hosted deployment executed. |
| Full Git history secret scan | Gitleaks 8.30.1 scanned all 15 existing commits, approximately 1.27 MB; no findings. The final patched 197-file source-only snapshot (968.58 KB of scanned text) also passed. After release-preparation commit `6e9fc3a`, all 16 commits were rescanned (1.36 MB) with no findings. Subsequent publication edits still require scanning before upload. |
| Dependency audit | A later clean install reported six high package entries: the existing development glob chain plus Next.js. Next.js and its lint configuration are now pinned to 16.3.8. The fresh production audit passed with zero findings; the patched application check passed and the environment-free static build passed. The unpatched `braces` chain remains open. |
| GitHub / Vercel / Supabase access | Public GitHub source uploaded with preserved history. Reconnected Vercel plugin can access the intended team; use of its existing Pro plan was approved on October 11. Vercel's GitHub App still needs access to this newly created repository. Earlier CLI device flows did not establish a saved login. EnKay free project creation was refused at the two-active-free-project limit; no hosted Supabase project was created. |
| Hosted release and CI | [Both Linux CI jobs passed](https://github.com/nshaikh3/supabase-ai-story-reference/actions/runs/37883626288) on commit `280eb1e` after the lockfile repair. No Vercel deployment executed. [Static showcase](SHOWCASE.md) is the selected initial release; full-app hosted verification remains deferred. |

The official macOS ARM64 Gitleaks 8.30.1 archive was verified against the vendor release checksum: `b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`. The scanner ran locally with full secret redaction. A passing pattern-based scan is evidence, not proof that no sensitive information can exist.

## Clean-source verification

A source-only copy was assembled from the Git inventory in a new temporary directory, excluding ignored environment files, dependencies, generated output and the private planning brief. `npm ci` installed the patched lockfile successfully. `npm run build:showcase` then built the three public routes under Next.js 16.3.8 with no backend environment, and its packaging checks confirmed zero Server Actions and 45 static files. The clean-copy browser check also passed on the patched build (one scenario, no retries, 26.4 seconds total). The verified static output was copied back after comparing all non-Markdown source files. This is an independent directory on the same laptop, not a GitHub/Linux CI result.

The actual full-app prebuild command also rejected `VERCEL=1` with local configuration as required. It was an expected negative check, not an application build failure.

## Verified presentation artifacts

- [Desktop screenshot](images/recruiter-demo.png) and [mobile screenshot](images/recruiter-demo-mobile.png) were captured from the static export. The mobile image was inspected for layout and readability.
- The public-only browser test records an ignored short video. Authenticated browser video/traces remain disabled. This test artifact is not a narrated two-minute portfolio walkthrough.
- CI now includes a separate backend-free showcase job. Official `actions/checkout` and `actions/setup-node` v4 refs were resolved to immutable commit IDs before pinning; no deployment credentials are given to either test job.
- All nine original reuse hashes were verified. TypeScript and ESLint configuration adaptations for the separate export were recorded with new target hashes; no additional commercial code was copied.

## Framework security patch

The October 8 clean-install audit identified Next.js advisories affecting 16.3.6, including image-optimization SSRF, cache handling and development/metadata-route disclosure. [The official 16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8) contains the corresponding fixes. The repository pins Next.js and its matching lint configuration to 16.3.8, preserving the same minor release. After installation the fresh production audit passed with zero findings. The patched application check and clean-copy static build passed; browser results are tracked in this record; older passing 16.3.6 results are not patch verification.

The static showcase has no server-side optimizer, Auth data or dynamic cache. That reduced exposure is not used as a reason to retain the affected dependency in the full local application.

## Remaining dependency finding

The dependency path is `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. This is development/build tooling; it is absent from the production dependency audit. The advisory concerns stack exhaustion from deeply nested patterns. The reference application's public input is not passed to this linting dependency. Run untrusted pull-request checks on disposable runners without deployment credentials; keep lint/build tools outside the public request path.

No incompatible package downgrade, hidden audit exclusion, blanket exception or unreviewed vendored patch was applied. Recheck [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) at release. An independent, time-bounded risk decision remains pending if no compatible fix is available.

## Current failures and recovery

- The initial full eight-scenario browser run passed four scenarios (anonymous access, callback rejection, public demo and headers). Four account-based scenarios failed at sign-up before reaching their feature assertions. Reference Auth/Storage/Realtime/mail/database health subsequently failed; the project-only stop was incomplete. These are failed checks, not passing feature evidence.
- After the user restarted Docker on October 8, guarded core startup verified service health and isolated loopback networking. The following database test/lint attempts then failed with `Connection terminated unexpectedly`; type comparison also exited unsuccessfully. No policy, credential or guard was changed to suppress those failures. The reference-only stop then succeeded and retained its data. After builds finished, a fresh core start and database reset passed, all seven migrations applied, all 356 assertions passed, lint was clean and generated types matched. The full patched browser rerun then passed all eight scenarios in 3.2 minutes with zero retries. Two nonfatal Next `destination stream closed early` diagnostics occurred during generation/Realtime scenarios; their assertions passed, and this known diagnostic is retained as a limitation. This recovery does not establish a root cause for the earlier connection failures. The earlier full passing checkpoint remains historical evidence only.
- The first static export compiled and rendered all public pages, but the packaging guard rejected Next.js's generated `/_global-error/page`. That built-in error route was inspected and added explicitly to the allowed manifest; private routes remain forbidden. The corrected build passed with three public routes, zero Server Actions and 45 static files.
- Next build concurrency was bounded to two workers and the documented Webpack memory optimization enabled for this resource-constrained host. Type checks and all runtime health checks remain required.
- Vercel's official CLI device flow was started as a fallback but ended without a completed login. No token was copied into source or chat. A later team-list check still returned no accessible teams. The second device page displayed a disabled Allow Access button even after refresh; its process exit was not treated as proof of authentication. Inspection of CLI 50.22.1 found that expiry can return from its polling loop without an error and produce exit zero without saving credentials. The registry-verified current CLI 63.1.0 was installed into a temporary tools directory, leaving project/global dependencies unchanged; a new user-approved sign-in flow is pending.
- Automatic approval review rejected the GitHub browser create action because it required action-time public-creation confirmation. The user chose to submit the prepared form personally. No workaround creation was attempted.

## Connection and release sequence

1. Public source upload is complete, Vercel plugin access is restored, and the existing Pro team is authorized. Complete repository-specific access for the Vercel GitHub App before deployment.
2. Complete static build/browser checks, a clean-source install and final secret scan; preserve the existing Git history when publishing source.
3. Deploy only the reviewed read-only showcase as a separate project on the verified existing Vercel Pro team. It requires no Supabase project, SMTP, AI key or environment file.
4. Verify the real anonymous HTTPS URL, all chapters, CSP, mobile layout and absence of private routes. Record commit/deployment/CI URLs before adding portfolio links.
5. Keep the full application local, repair local runtime verification separately, and retain future hosted-application gates without claiming they passed.

The user has authorized the work; these are missing decisions/access and verification requirements, not a request to repeat general publication permission.

## Verified local handoff

Release-preparation commit: `6e9fc3a`. On the patched Next.js 16.3.8 build, 308 unit tests, 356 SQL assertions, eight full-app browser scenarios and the separate clean-copy static browser scenario passed. Documentation validation checked 26 Markdown files and 202 local links. The production audit is clear; the development glob advisory remains recorded above. The local static preview at `http://127.0.0.1:3101/demo` returned HTTP 200 with the expected content and CSP.

This local checkpoint preceded source publication. See the October 9 record below for the actual GitHub release and restored Vercel access. No hosted deployment, live URL or full-app cloud verification is claimed yet. Passing Linux CI is recorded below.

## October 9 source publication and CI

The public repository is [nshaikh3/supabase-ai-story-reference](https://github.com/nshaikh3/supabase-ai-story-reference). GitHub metadata initially reported size zero, but a direct Git ref inspection found the user-created MIT license commit `ad3f123`. Its history and license were preserved by merging the independent local history; publication commit `c7f403e` was pushed successfully. The license names the GitHub owner `nshaikh3`. The pre-push Gitleaks scan reported no findings across the 17 local commits; the merged-history scan also reported no findings (18 scanned commits, about 1.36 MB).

[The first GitHub Actions run](https://github.com/nshaikh3/supabase-ai-story-reference/actions/runs/37883310662) failed in both jobs at `npm ci`, before any application or database assertions ran. npm 11.19.0 on the Linux runner required missing `@emnapi/core` and `@emnapi/runtime` 1.11.3 lock entries. Regenerating only the lockfile in a dependency-free temporary directory restored optional/bundled dependency metadata without changing any previously locked package versions. Cleanup now runs only if dependency installation succeeded, avoiding a misleading secondary missing-CLI failure. Verification of the repair is tracked separately from the earlier local checkpoint.

The reconnected Vercel plugin now lists and reads the intended team. A read-only dashboard inspection shows the team is on **Pro**, even though the user-profile API reports Hobby for the personal profile. No Vercel project has been created or deployed. The user was asked whether to retain a separate Hobby-only scope or explicitly authorize the existing Pro team's usage; no budget change is inferred.

The repaired lockfile passed a clean npm 11.19.0 install in a fresh temporary directory. The source-only showcase build then passed with three public routes, zero Server Actions and 45 static files. Its browser scenario passed without retries (22.3 seconds), covering chapters, mobile layout, CSP, reload, private-route 404s and POST rejection. The production audit again found zero vulnerabilities. The full audit still reports the same five development-chain high entries. Documentation validation passed for 26 Markdown files and 203 local links. These are local repair checks, not a passing Linux CI result.

## Verified Linux CI acceptance

[GitHub Actions run 37883626288](https://github.com/nshaikh3/supabase-ai-story-reference/actions/runs/37883626288) completed successfully on October 9 for implementation commit `280eb1e9a411cd1efb18ef8b993b2b8920f23830`. Both `showcase` and `reference` jobs passed on Ubuntu with Node 24.21.0 and npm 11.19.0. The reference job passed 308 unit tests, 356 SQL assertions, generated types, database lint/advisors, concurrency/cleanup checks, application type/lint/build checks, eight browser scenarios (56.1 seconds), and eleven authenticated query plans with fixture rollback. A second database reset and all 356 assertions also passed. The showcase job passed its clean install, production dependency audit, static build and browser scenario. The production audit found zero vulnerabilities; this does not resolve the documented development-only advisory.

The subsequent documentation-only publication update records these results and runs `npm run docs:check` locally. It does not change the tested application, dependency lockfile, workflow or showcase output; the implementation evidence remains tied to the exact commit above. Public source and CI acceptance are achieved. Vercel deployment and anonymous HTTPS acceptance remain pending GitHub repository access for Vercel.

## October 11 hosting authorization and repository access

The user explicitly authorized the existing Vercel Pro plan, with no new plan or add-on. The intended team remains `team_jvHUtXxekXttJtd2toxcfEs4` (`noorurrahman94-gmailcoms-projects`). The documentation evidence commit `11e84af` was pushed; tested application code is unchanged from the passing October 9 CI commit.

Creating the Git-linked reference project through the Vercel plugin returned HTTP 400 stating that the GitHub integration must be installed or granted repository access. A follow-up project listing confirmed no reference project was created. The Vercel import UI lists the existing selected repositories, but not this new reference repository. Its **Adjust GitHub App Permissions** control opened the existing Vercel installation settings for `nshaikh3`; GitHub requires password re-confirmation before those settings can be changed. The user was asked to authenticate directly on GitHub and add only the reference repository, preserving existing selections. No password was requested in chat or retrieved, and no existing project was changed.
