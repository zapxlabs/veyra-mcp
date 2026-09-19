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

- **Smithery**: live and published at https://smithery.ai/servers/labszapx/veyra (quality 69/100, all 7
  tools enumerated). No connection parameter is defined, deliberately: users get a token from the Veyra
  dashboard and connect directly, so no spending-capable credential passes through Smithery's gateway.
  Smithery warns about the missing `configSchema` in the release log; that warning is the intended state.
  Re-publish a release from the Releases tab whenever the tool surface changes.
- **Glama**: still pending, and needs a human. https://glama.ai/mcp/servers → *Add Server* opens a signup
  wall with a CAPTCHA. Glama also auto-indexes public GitHub repos, so this may resolve itself. The Glama
  score badge URL used in the awesome-mcp-servers entry already returns an SVG.
  Worth also listing the remote endpoint under Glama's separate *Connectors* directory, which is what
  produces the connector badge both awesome lists display.

## 4. Awesome lists

Both are open (titles end in `🤖🤖🤖`, the maintainer's fast-track marker for agent-authored PRs):

- punkpeye/awesome-mcp-servers#14682 — Finance & Fintech
- punkpeye/awesome-remote-mcp-servers#434 — Payments

The remote-list PR has one unchecked box: the entry has no Glama connector badge, because the connector does
not exist yet. Add the badge and push to the same branch once Glama lists it.

## 5. Social preview image

Done — `assets/social-preview.png` is uploaded. GitHub has no API for this; to change it, go to
Repo → Settings → General → Social preview.
