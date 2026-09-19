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
- **Glama**: both listings are live.
  - Server (the repo): https://glama.ai/mcp/servers/zapxlabs/veyra-mcp — Glama auto-indexed it from GitHub
    before we submitted, which is why the manual *Runs from source* submission was rejected as a duplicate.
    Currently rated **B**. Badge: `https://glama.ai/mcp/servers/zapxlabs/veyra-mcp/badges/score.svg`
  - Connector (the endpoint): https://glama.ai/mcp/connectors/money.veyra/veyra — namespace is `money.veyra`,
    derived from the domain, **not** `io.github.zapxlabs`. Badge:
    `https://glama.ai/mcp/connectors/money.veyra/veyra/badges/score.svg`
  - Neither is **claimed** yet. Claiming is optional (Glama keeps fetching either way) but unlocks editing the
    description, health checks and analytics — the connector currently reads "Not tested / Never" because
    health checks only run for claimed connectors. Verification options are GitHub OAuth, an HTTP challenge,
    or a DNS TXT record. Prefer the HTTP challenge or DNS record: they prove control of veyra.money, which is
    the right thing to prove for a `money.veyra` namespace, and hand Glama no GitHub account access.

## 4. Awesome lists

Both are open (titles end in `🤖🤖🤖`, the maintainer's fast-track marker for agent-authored PRs):

- punkpeye/awesome-mcp-servers#14682 — Finance & Fintech
- punkpeye/awesome-remote-mcp-servers#434 — Payments

Both now pass the maintainer's bots: #14682 has `has-emoji`, `valid-name`, `has-glama`; #434 has
`endpoint-ok`, `has-connector` and all checks green.

One open question on #434. Its checker probes the endpoint, sees the handshake answer anonymously, and wants
the auth marker changed from 🔑 (API key) to 🔓 (none). That would be misleading — every `tools/call` still
needs a bearer token — so we left it at 🔑 and explained in a comment, offering to defer to the maintainer.
If they insist on 🔓, change it; it is their list.

## 5. Social preview image

Done — `assets/social-preview.png` is uploaded. GitHub has no API for this; to change it, go to
Repo → Settings → General → Social preview.
