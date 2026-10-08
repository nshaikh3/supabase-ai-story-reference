# Recruiter demo and publication execution

## Scope and authorization

On October 7, 2026, the user expanded the earlier local-only scope to include the missing demo page, a public GitHub repository, a live deployment and the remaining achievable portfolio deliverables. Publication and deployment are now authorized. The user selected `nshaikh3` as the intended owner, the MIT license and **free-tier resources only, with no paid upgrades**. GitHub authentication confirmed `nshaikh3`; Supabase organization EnKay was selected. The user subsequently chose to publish only the read-only showcase and retain the full app locally after free Supabase project creation was refused. Vercel team access remains unresolved; credentials are not requested in chat.

The commercial application's services remain excluded. Local wrappers retain their local-only protections. Human review and personal interview understanding cannot be supplied or attested by an automated implementation run.

## Work and evidence

| Item | Current state |
| --- | --- |
| `/demo` and `/architecture` | Implemented. Final patched (Next.js 16.3.8) application check passed 308 unit tests, types, lint and production build. The initial full-app demo browser scenario passed desktop/mobile. |
| Landing-page navigation | Demo/architecture links implemented. GitHub link appears when a real repository URL is configured. |
| Public links | [Publication manifest](../deployment/publication.json) remains null until actual resources exist; no fabricated URLs. |
| Case study | [Draft completed](CASE-STUDY.md); publication/verification claims remain scoped to actual evidence. |
| Vercel configuration | A separate Next.js static showcase and Vercel Build Output package are implemented. No backend configuration, private routes or Server Actions enter that deployment. Packaging and the isolated browser scenario passed: all chapters, CSP, mobile, reload, no external requests, private-route 404s and POST denial. No hosted deployment executed. |
| Full Git history secret scan | Gitleaks 8.30.1 scanned all 15 existing commits, approximately 1.27 MB; no findings. The final patched 197-file source-only snapshot (968.58 KB of scanned text) also passed. After release-preparation commit `6e9fc3a`, all 16 commits were rescanned (1.36 MB) with no findings. Subsequent publication edits still require scanning before upload. |
| Dependency audit | A later clean install reported six high package entries: the existing development glob chain plus Next.js. Next.js and its lint configuration are now pinned to 16.3.8. The fresh production audit passed with zero findings; the patched application check passed and the environment-free static build passed. The unpatched `braces` chain remains open. |
| GitHub / Vercel / Supabase access | All three integrations connected. GitHub owner and existing Git push credential verified without printing credentials; creation form prepared and left for the user to submit at their request. Vercel default-team access returns 403. Two CLI device flows ended without a usable saved login; the second exited zero but the subsequent authenticated team probe still reported no credentials. EnKay project creation quoted $0/month but was refused at the two-active-free-project limit. No hosted resources were created. |
| Hosted release and CI | Not executed. [Static showcase](SHOWCASE.md) is the selected initial release. Full-app hosted verification is deferred and its [deployment gates](DEPLOYMENT.md) remain open. |

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

1. Complete account access and the user-owned GitHub form submission; verify the actual public repository exists.
2. Complete static build/browser checks, a clean-source install and final secret scan; preserve the existing Git history when publishing source.
3. Deploy only the reviewed read-only showcase to a verified free Vercel project. It requires no Supabase project, SMTP, AI key or environment file.
4. Verify the real anonymous HTTPS URL, all chapters, CSP, mobile layout and absence of private routes. Record commit/deployment/CI URLs before adding portfolio links.
5. Keep the full application local, repair local runtime verification separately, and retain future hosted-application gates without claiming they passed.

The user has authorized the work; these are missing decisions/access and verification requirements, not a request to repeat general publication permission.

## Verified local handoff

Release-preparation commit: `6e9fc3a`. On the patched Next.js 16.3.8 build, 308 unit tests, 356 SQL assertions, eight full-app browser scenarios and the separate clean-copy static browser scenario passed. Documentation validation checked 26 Markdown files and 202 local links. The production audit is clear; the development glob advisory remains recorded above. The local static preview at `http://127.0.0.1:3101/demo` returned HTTP 200 with the expected content and CSP.

The user still needs to submit the prepared GitHub creation form and complete Vercel device authorization. An existing Git credential was verified for `nshaikh3`, so source can be pushed with its history once that repository exists. No public repository, hosted deployment, live URL, hosted CI success or full-app cloud verification is claimed.
