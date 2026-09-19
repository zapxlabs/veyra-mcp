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

- **Glama**: https://glama.ai/mcp/servers — search for `zapxlabs/veyra-mcp`, click *Claim*, sign in with GitHub. Once claimed, the score badge in the README goes live.
- **Smithery**: https://smithery.ai — *Add server*, point at this repo, choose *remote* with the URL `https://veyra.money/api/mcp` and auth type *API key* (bearer).
- **PulseMCP** and **mcp.so** index the official registry and GitHub topics automatically.

## 4. Awesome lists

Two branches are ready on the forks:

- https://github.com/zapxlabs/awesome-mcp-servers/tree/add-veyra → PR to `punkpeye/awesome-mcp-servers` (Finance & Fintech)
- https://github.com/zapxlabs/awesome-remote-mcp-servers/tree/add-veyra → PR to `punkpeye/awesome-remote-mcp-servers` (Payments)

Open each with the compare link, keep the title as the commit message, and end the title with `🤖🤖🤖` if you want the maintainer's fast-track for agent-authored PRs.

## 5. Social preview image

GitHub has no API for this. Repo → Settings → General → Social preview → upload `assets/social-preview.png`.
