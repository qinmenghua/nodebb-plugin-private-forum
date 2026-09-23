# nodebb-plugin-private-forum (NodeBB v4 compatible)

A NodeBB plugin that locks the forum down to registered users: anonymous
visitors are redirected to the login page on every content route.

This is a **v4-compatible single-hook rewrite** of the original
[LM1LC3N7/nodebb-plugin-private-forum](https://github.com/LM1LC3N7/nodebb-plugin-private-forum),
maintained at [qinmenghua/nodebb-plugin-private-forum](https://github.com/qinmenghua/nodebb-plugin-private-forum).
The original only declared `nbbpm.compatibility: ^1.11.0` and was never updated past
v1.3.1. The rewrite preserves the original intent while working cleanly on
NodeBB v4, and fixes two SPA-era bugs (see *Behaviour notes*).

## What it does

- Redirects anonymous users to `/login` on all content pages.
- Keeps the login, register, reset, auth, confirm, email, and sitemap flows
  reachable, so visitors can still sign up and recover their password.
- Keeps all static assets (`/assets/...`, `/plugins/...`, and `.css`/`.js`/
  image/font/source-map extensions) reachable so the login page itself renders
  correctly.
- Does **not** expose any forum content to guests: every `/api/*` route except
  the public page APIs (`/api/login`, `/api/register`, `/api/reset`) stays
  guarded and returns `401` to anonymous callers.

## Behaviour notes (why a rewrite was needed)

NodeBB v4 is a single-page app: client-side navigation fetches `/api/<route>`
instead of doing a full page load. This plugin therefore has to guard **both**
the server-rendered page **and** the SPA's API calls, or two bugs appear:

1. **Register / password-reset bounced to login.** The SPA fetches
   `/api/register` and `/api/reset` to render those pages. If those API routes
   are guarded, the guest client is thrown back to `/login`. This rewrite
   allowlists `/api/login`, `/api/register`, and `/api/reset` so the SPA can
   fetch the page JSON without being bounced.
2. **"Must refresh to trigger" redirect.** If the page guard *skips* `/api/*`
   entirely, a guest SPA navigation to `/recent` gets a `200` with empty data
   and renders a blank page instead of redirecting — only a manual refresh (a
   real HTML load) would then 302 to `/login`. By guarding every non-allowlisted
   `/api/*` route, the SPA now receives a `401` and immediately redirects to
   `/login` client-side, with no refresh required.

Both cases were verified against a live v4.16.0 instance using a headless
browser: clicking a protected link auto-redirects to `/login`, and the register
/ reset pages open via SPA navigation.

## How it works

The plugin registers a single hook, `response:router.page → privateforum`. In
NodeBB v4 that hook fires inside `middleware.pluginHooks` **before** the
response is sent, so calling `helpers.notAllowed(req, res)` performs a clean
`302` to `/login` for anonymous users. `req.loggedIn` is still populated by the
user middleware in v4 (`req.loggedIn = req.uid > 0`), so the guard is
straightforward.

The allowlist is one anchored regular expression covering the public page
paths, the three public page APIs, and static asset extensions. Anonymous hits
outside the allowlist are redirected; everything else (including all other
`/api/*` routes) is blocked.

> **Registry note.** This plugin does **not** try to whitelist the NodeBB
> package registry via a `filter:request.init` hook — NodeBB clears its SSRF
> allow-list after that hook fires, so such a hook cannot help. Registry
> reachability (relevant for ACP analytics / plugin suggestions) must be solved
> at the deployment level, e.g. a custom image that patches `src/ssrf.js`, or a
> proxy that does not map `packages.nodebb.org` to a reserved IP.

## Compatibility

`nbbpm.compatibility: ^4.0.0` — tested against NodeBB v4.16.0.

## Installation

The npm package name is **`nodebb-plugin-private-forum-v2`** (the upstream
`nodebb-plugin-private-forum` name is taken on npm by the original author).

```bash
npm install nodebb-plugin-private-forum-v2
```

Then activate **Private Forum (v2)** in the NodeBB ACP (Plugins page).

> **Plugin id note.** NodeBB derives a plugin's id from `package.json`'s `name`
> (`pluginData.id = packageData.name` in `src/plugins/data.js`), and looks it up
> at `node_modules/<id>`. The id of this plugin is therefore
> **`nodebb-plugin-private-forum-v2`**, and the installed folder must carry the
> same name. The `id` field in `plugin.json` is ignored by NodeBB.

For a self-hosted / offline build, drop the plugin source into a directory
bind-mounted into the container and reference it via the
`NODEBB_ADDITIONAL_PLUGINS` environment variable (the approach used on the
deployed instance). **Keep the directory name identical to the package name**
so the plugin id resolves correctly. Example `docker-compose` snippet:

```yaml
services:
  nodebb:
    image: nodebb-custom:4.x
    environment:
      NODEBB_ADDITIONAL_PLUGINS: /opt/custom-plugins/nodebb-plugin-private-forum-v2
    volumes:
      - ./custom-plugins:/opt/custom-plugins:ro
```

After changing `library.js`, restart the NodeBB container to rebuild with the
plugin.

## Publishing

Publishing to npm is automated via GitHub Actions
(`.github/workflows/npm-publish.yml`) using **npm Trusted Publishing (OIDC)** —
there is **no `NPM_TOKEN` secret** anywhere. The workflow exchanges a
short-lived GitHub OIDC token for a publish credential scoped to this
repository + workflow file, and publishes with a signed provenance
attestation.

A release is published whenever a GitHub **Release** is published whose tag
matches `package.json`'s `version`.

### One-time bootstrap (required once, for the very first version)

npm has **no "pending trusted publisher"** feature: it will not let you
configure a trusted publisher for a package that does not exist yet
([npm/cli#8544](https://github.com/npm/cli/issues/8544)). So the first version
must be published manually, and only then can OIDC take over:

```bash
# 1. publish v2.0.3 by hand, from your own machine (interactive 2FA)
cd nodebb-plugin-private-forum
npm login
npm publish --access public
```

```text
# 2. register this workflow as a trusted publisher on npmjs.com:
#      https://www.npmjs.com/package/nodebb-plugin-private-forum-v2/access
#    Trusted publishing -> GitHub Actions
#      Organization or user : qinmenghua
#      Repository           : nodebb-plugin-private-forum   (repo name only)
#      Workflow filename    : npm-publish.yml                (name only, no path)
#      Environment name     : (leave EMPTY)
#      Allowed actions      : must include "npm publish"
#    Trusted publishers created after 2026-09-03 default to stage-only
#    ("npm stage publish"), so direct publish must be ticked explicitly.
#
#    Equivalent CLI (npm >= 11.15):
#      npm trust github nodebb-plugin-private-forum-v2 \
#        --file npm-publish.yml \
#        --repo qinmenghua/nodebb-plugin-private-forum \
#        --allow-publish
```

Every release after that publishes itself with no token and no second factor.

### Release flow

```bash
# 1. bump the version and commit
npm version patch          # or edit package.json manually
git push

# 2. create a GitHub Release with a matching tag, e.g. v2.0.4
#    (the workflow then runs `npm publish` via OIDC)
```

The workflow verifies the release tag equals `v<package.json version>` and
aborts otherwise, so a mistyped tag never publishes a mismatched build.

### Requirements and gotchas

- **npm CLI ≥ 11.5.1, Node ≥ 22.14.0.** The workflow upgrades npm explicitly
  (`npm install -g npm@latest`) because the npm bundled with Node 22 on the
  runners is older; without it the OIDC exchange silently fails.
- **`registry-url` must NOT be set on `actions/setup-node`.** If it is,
  setup-node writes an `.npmrc` with `_authToken=${NODE_AUTH_TOKEN}` plus a
  placeholder token, npm attempts token auth, skips OIDC, and fails with a
  misleading `E404`/`ENEEDAUTH`. npm already defaults to
  `registry.npmjs.org`.
- **`repository.url` must match the repo that runs the workflow** — vital for a
  fork like this one, otherwise the OIDC claims and the provenance check
  disagree.
- The npm account must have **2FA enabled** (npm policy for publishing). A
  granular token with *bypass 2FA* is an alternative for manual publishes, but
  npm is deprecating bypass-2FA tokens for direct publishing — another reason
  to use OIDC.

## License

MIT — original work by Louis MILCENT (LM1LC3N7); v4 rewrite maintained
separately.
