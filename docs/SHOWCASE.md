# Read-only public showcase

The user selected this release on October 8, 2026: publish an account-free demo using free-tier hosting, while keeping the complete private application local. Supabase refused a new free project because the account already has two active free projects. No existing project is reused or changed.

## Build and preview

```bash
npm ci
npm run build:showcase
npm run test:showcase
npm run preview:showcase
```

Open `http://127.0.0.1:3101`. This flow requires no Docker, Supabase key, environment file or AI provider. The existing full app continues to use its guarded local setup on port 3100.

The separate [showcase app](../showcase/app) has only `/`, `/demo` and `/architecture`, plus a 404 page. It imports the same public components and fictional story used by the full app. Sign-in links are omitted. There are no Auth forms, private routes, middleware, Server Actions, database clients, uploads or generation endpoints in this build.

[The build script](../scripts/showcase-build.mjs) runs Next.js with a restricted environment, refuses showcase environment files, checks the route and Action manifests, and scans output for backend configuration markers. It writes only static assets to `.vercel/output/static` and generates [Vercel Build Output API](https://vercel.com/docs/build-output-api) configuration. Inline hydration scripts receive exact SHA-256 CSP hashes from the built HTML; scripts do not require `unsafe-inline` or `unsafe-eval`. Browser checks exercise the packaged headers, all story pages, mobile layout, direct navigation, missing private routes and denied POST requests. The local preview does not prove Vercel routing; repeat these checks on the actual public URL.

## Deployment contract

[vercel.json](../vercel.json) selects `npm ci` and `npm run build:showcase`, with no framework adapter or server functions. Use the repository root and Node 24. Do not add environment variables, a Supabase integration, paid AI, a paid domain or a paid hosting upgrade. The generated output has no Functions directory. A stable free `vercel.app` URL is sufficient.

Deploy only to the verified account/team and a new reference-only project. Prefer linking the authorized public repository after the user creates it and source is uploaded. If the official CLI is used, explicitly verify the reference project/team before deployment. Keep preview protection until verified; the requested production showcase must be reachable by an anonymous reviewer.

Record the actual deployment ID, source commit, production URL, date and acceptance result in [PUBLICATION.md](PUBLICATION.md). Only then populate [publication.json](../deployment/publication.json) and rebuild to show working source links. A deployment URL or a successful build alone is not acceptance evidence.

## Security and limitations

The public site serves bundled fictional content and makes no backend requests. Its architecture text describes the locally runnable full application, not a hosted authenticated service. Authentication, private files, generation and live updates remain available through the local setup and source walkthrough.

The full application's nonce CSP, owner policies, target manifest and local-only wrappers remain in force. Static deployment is a separate build target, not a relaxation of those controls. Hosted database/Auth/Storage/Edge/Realtime, SMTP, worker rotation, backups and operational review remain unverified and deferred; see [DEPLOYMENT.md](DEPLOYMENT.md).

The development-only dependency advisory remains visible in [PUBLICATION.md](PUBLICATION.md). Build untrusted changes without deployment credentials. Public demo recordings contain only the fictional sample; authenticated browser artifacts remain disabled.
