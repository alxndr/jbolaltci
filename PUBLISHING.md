# publishing

Releases go out via GitHub Actions, using npm's Trusted Publishing (OIDC) -- see `.github/workflows/publish.yml`.
No npm token lives in this repo or on anyone's laptop; each publish is authenticated per CI run and tied to this exact repo + workflow file. See [ADR 002](./docs/architecture-decisions/002-publish-via-oidc-trusted-publishing.md) for why.

**`0.2.0-alpha` is published** (the one-time bootstrap below, done manually), and the npm Trusted Publisher is now configured -- `0.2.0-rc.0` was published automatically by `publish.yml` on 2026-08-15, no local `npm publish` involved. The normal release flow below is fully live.

## normal release

1. Land your changes on `main` -- `.github/workflows/ci.yml` runs typecheck/test/build on every push and PR, so `main` should always be in a publishable state.
2. Move the `[Unreleased]` entries in `CHANGELOG.md` into a new `[X.Y.Z] - YYYY-MM-DD` section (leave `[Unreleased]` empty at the top for whatever comes next). **This section's body becomes the GitHub Release notes verbatim** (`scripts/changelog-section.mjs` extracts it in step 5 below) -- write it for that audience, not just as an internal log.
3. Bump the version and tag it in one step:
   ```sh
   npm version patch   # or: minor / major / prerelease --preid=alpha / 1.2.3
   ```
   This edits `package.json`'s `version`, commits it (`vX.Y.Z`), and creates a matching git tag -- all locally, nothing pushed yet.

   **A git tag is a fixed pointer to one commit -- it does not move if you later amend that commit.** So finish everything for the release (the `CHANGELOG.md` update from step 2 included) *before* running `npm version`/`git tag`, not after. If something does need fixing afterward and nothing's pushed yet: `git commit --amend`, then re-create the tag (`git tag -d vX.Y.Z && git tag vX.Y.Z`) so it points at the amended commit -- don't just amend and assume the tag followed along. Sanity check before pushing:
   ```sh
   git rev-parse HEAD vX.Y.Z   # these two SHAs must match
   ```
4. Push the commit and the tag:
   ```sh
   git push && git push --tags
   ```
   Always use the `v` prefix -- `publish.yml` only triggers on tags matching `v*`. A tag created without it (including via GitHub's web UI, which doesn't enforce the prefix) won't trigger a publish.
5. The `vX.Y.Z` tag push triggers `publish.yml`, which first waits for `ci.yml`'s run on that exact commit to finish and requires it to have succeeded (polls `gh run list --workflow=ci.yml --commit <sha>`, 15 min timeout) -- then typechecks (both `typecheck` and `typecheck:web`), runs the unit tests, builds, publishes to npm, and creates the matching GitHub Release (title and tag both `vX.Y.Z`, notes pulled straight from that version's `CHANGELOG.md` section, marked prerelease/latest based on whether the version string has a `-` in it) -- watch it at https://github.com/alxndr/jbolaltci/actions.

   Note: `publish.yml` still deliberately does **not** run the Playwright e2e suite itself -- it runs on a plain `ubuntu-latest` runner with no browsers installed. Instead, since a tag push and the push-to-`main` that (usually) precedes it are separate, unordered events, the wait step above confirms `ci.yml` -- including its `e2e` job and the Pages `deploy` it gates -- actually ran and passed for this commit, rather than just assuming it did. If you tag a commit that was never pushed to `main` (so `ci.yml` never ran on it), this step times out after 15 minutes and the publish is refused.
6. Confirm it's live: `npm view jbolaltci version`, or check https://www.npmjs.com/package/jbolaltci and https://github.com/alxndr/jbolaltci/releases.

## prerelease versions

```sh
npm version X.Y.Z-alpha --no-git-tag-version   # hand-set the exact version
# ...finish CHANGELOG.md, commit everything together, then tag (see step 3 above)
git push && git push --tags
```

If a target version needs more than one round -- something's found wrong with the first alpha and it needs a follow-up before promotion -- number them instead of overwriting: `npm version prerelease --preid=alpha` bumps `X.Y.Z-alpha.N` iteratively (`.0` -> `.1` -> ...) rather than hand-setting the string each time.

`publish.yml` reads the dist-tag off the version string itself: anything with a `-` in it (`0.3.0-alpha`, `1.0.0-rc.1`, ...) publishes under that prerelease identifier as the npm dist-tag (`alpha`, `rc`, ...) instead of `latest`. Normally that means `npm install jbolaltci` gets the last non-prerelease version and only `npm install jbolaltci@alpha` picks up a prerelease -- **but not for a package's first-ever publish**: npm's registry won't let a package exist with zero dist-tags, so even with `--tag alpha`, that very first publish (`0.2.0-alpha`, here) also gets `latest` assigned to it, since there's nothing else for `latest` to point at yet. Confirmed via `npm dist-tag ls jbolaltci` right after publishing. This self-corrects the moment a real non-prerelease version is published without an explicit `--tag` (the normal case in step 3/4 above) -- `latest` moves off the prerelease then. Until that happens, `latest` (and a plain `npm install jbolaltci`, and what npmjs.com's package page shows as the current version) still points at `0.2.0-alpha`, even after later prereleases like `0.2.0-rc.0` are published under their own dist-tag -- this is expected, not a bug.

npm's provenance verification (part of Trusted Publishing) cross-checks the Sigstore attestation's repo URL against `package.json`'s `repository` field -- if that field is missing or wrong, `npm publish` fails with a 422 (`"repository.url" is "", expected to match ...`). Hit this on the first automated run; fixed by adding a `repository` field, published as `0.2.0-rc.0`.

## one-time bootstrap

npm's Trusted Publishing requires a package to already exist on the registry before you can configure OIDC for it -- there's no PyPI-style "pending publisher" for a brand-new name. So the very first version has to be published manually, from a local, already-`npm login`'d machine:

```sh
npm publish --dry-run --tag alpha   # sanity-check the tarball contents first
npm publish --tag alpha
```

**Done** -- `0.2.0-alpha`, published 2026-08-15. `npm publish` prompted for a one-time password (2FA-on-publish); the URL it printed to authenticate is a short-lived credential and gets masked even in npm's own debug log, so that step has to be run interactively in a real terminal, not relayed secondhand.

**Also done** -- Trusted Publisher configured on npmjs.com (package page → Settings → Trusted Publisher → GitHub Actions publisher, org `alxndr`, repo `jbolaltci`, workflow `publish.yml`, no environment). Verified working: `0.2.0-rc.0` published automatically via the tag-push flow on 2026-08-15, no local `npm publish` involved. That's the normal path for every release from here on.
