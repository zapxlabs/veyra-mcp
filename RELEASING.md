# Releasing and listing

Steps that need an account login and therefore a human. Everything else (build, tests, CI, GitHub Pages, release notes) is automated.

## 1. Publish to npm

npm requires two-factor auth on the publishing account. Enable it once at
https://www.npmjs.com/settings/zapxlabs/tfa (authenticator app), then:

```bash
npm login                       # once
npm version patch|minor|major   # bumps package.json + tags
npm publish --access public     # runs build + tests first (prepublishOnly)
git push --follow-tags
```

Then create a GitHub release for the tag with the CHANGELOG entry as the body.

## 2. Publish to the official MCP Registry

Status: `io.github.zapxlabs/veyra` 0.1.1 is live with both the remote endpoint and the npm
package (`veyra-mcp@0.1.0`). Registry versions are immutable, so the server.json version runs one
ahead of the package until the next npm release; from then on bump both to the same number.
The registry verifies `mcpName` in the published package.json, so always `npm publish` first.

```bash
brew install mcp-publisher      # or the curl one-liner in the registry docs
mcp-publisher login github      # device-code flow, proves ownership of io.github.zapxlabs/*
mcp-publisher validate          # server.json in this directory
mcp-publisher publish
```

Bump `version` in `server.json` to match `package.json` on every release.

## 3. Directories that crawl GitHub

- **Glama**: https://glama.ai/mcp/servers — not yet indexed as of 2026-09-19. *Add Server* opens a signup wall
  (email or GitHub OAuth, with a CAPTCHA), so this needs a human. Once the server is listed, the score badge
  already referenced in README.md starts rendering. Glama also has a separate *Connectors* directory for remote
  endpoints — worth adding `https://veyra.money/api/mcp` there too, since both awesome-list categories show
  connector badges.
- **Smithery**: https://smithery.ai/new — also behind a sign-in wall (email, Google or GitHub). *Add server*,
  point at this repo, choose *remote* with the URL `https://veyra.money/api/mcp` and auth type *API key* (bearer).
- **PulseMCP** and **mcp.so** index the official registry and GitHub topics automatically.

## 4. Awesome lists

Both are open (titles end in `🤖🤖🤖`, the maintainer's fast-track marker for agent-authored PRs):

- punkpeye/awesome-mcp-servers#14682 — Finance & Fintech
- punkpeye/awesome-remote-mcp-servers#434 — Payments

The remote-list PR has one unchecked box: the entry has no Glama connector badge, because the connector does
not exist yet. Add the badge and push to the same branch once Glama lists it.

## 5. Social preview image

Done — `assets/social-preview.png` is uploaded. GitHub has no API for this; to change it, go to
Repo → Settings → General → Social preview.
