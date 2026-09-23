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
(`.github/workflows/npm-publish.yml`). A release is published whenever a GitHub
**Release** is created whose tag matches `package.json`'s `version`.

One-time setup — add a repository secret:

1. Create an npm **Automation** (or Granular, with publish rights) token at
   <https://www.npmjs.com/settings/~/tokens>.
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `NPM_TOKEN`, paste the token.

Release flow:

```bash
# 1. bump the version and commit
npm version patch          # or edit package.json manually
git push

# 2. create a GitHub Release with a matching tag, e.g. v2.0.4
#    (the workflow then runs `npm publish`)
```

The workflow verifies the release tag equals `v<package.json version>` and
aborts otherwise, so a mistyped tag never publishes a mismatched build.

## License

MIT — original work by Louis MILCENT (LM1LC3N7); v4 rewrite maintained
separately.
