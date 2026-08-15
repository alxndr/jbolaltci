# 002 — publish via GitHub Actions and npm Trusted Publishing (OIDC)

**Date:** 2026-08-15

**Status:** Implemented


### Context

The library (`src/index.ts`/`src/browser.ts`) needs a release path to the npm registry. The traditional CI approach is a long-lived npm access token stored as a CI secret, used by a workflow step to run `npm publish`.

Options considered (the same three weighed in [alxndr/sparse-boolean-codec's ADR 004](https://github.com/alxndr/sparse-boolean-codec/blob/main/docs/architecture-decisions/004-trusted-publishing.md), which this decision follows):

* **Local `npm publish` from a developer machine** -- no CI integration at all, publishes happen manually whenever someone runs the command.
* **CI publish with a stored npm token** -- automated, but the token is a standing credential: if it leaks (compromised CI runner, misconfigured log output, a dependency in the build with a supply-chain compromise, etc.) it can publish under this package's name until someone notices and revokes it.
* **npm Trusted Publishing (OIDC)** -- GitHub Actions exchanges a short-lived OIDC token for npm publish authorization, scoped to a specific repo + workflow file, with no persisted secret anywhere. npm also attaches provenance automatically.

The same bootstrap constraint applies here as it did there: npm requires a package to already exist on the registry before Trusted Publishing can be configured for it, so the very first release has to be a manual, locally-authenticated `npm publish` regardless of which strategy handles releases afterward. Confirmed `jbolaltci` is unclaimed on the npm registry (as of this decision).

Unlike sparse-boolean-codec at the time its ADR 004 was written, that bootstrap publish had not happened yet when this decision was first written up -- publishing was explicitly deferred (prep the process now, actually publish later, as a separate deliberate step) rather than done as part of setting this up. It has since happened: `0.2.0-alpha` was published manually to bootstrap the package, the Trusted Publisher was configured on npmjs.com, and `0.2.0-rc.0` published automatically through `publish.yml` -- confirming the whole path works end-to-end.


### Decision

Publish via GitHub Actions, using npm Trusted Publishing (OIDC), triggered on `v*` tag pushes (`.github/workflows/publish.yml`, adapted directly from sparse-boolean-codec's). No npm token will live in this repo or on any developer machine for routine releases.

`publish.yml` computes its npm dist-tag from the version string itself -- any version containing a `-` publishes under that prerelease identifier instead of `latest` -- and creates a GitHub Release using the matching section of `CHANGELOG.md` as release notes (`scripts/changelog-section.mjs`, also ported from sparse-boolean-codec, unchanged).

The first release still requires the same manual bootstrap step described above before this workflow can do anything: `npm publish` run locally once, to create the package on the registry, followed by configuring `jbolaltci`'s Trusted Publisher on npmjs.com scoped to this repo and the `publish.yml` workflow filename. See `PUBLISHING.md` for the full process. That bootstrap step is intentionally not part of this decision or its implementation -- it's a separate, deliberate action for whenever an actual first release is decided on.
