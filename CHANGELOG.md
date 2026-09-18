# Changelog

## 0.1.0 — 2026-09-19

First public release.

- `VeyraClient`: typed client for every tool on the hosted MCP endpoint, with
  distinct `VeyraToolError` (policy, validation, auth) and
  `VeyraTransportError` (network, rate limit) classes and a `waitForPayment`
  helper.
- `veyra-mcp` binary: stdio bridge for hosts that cannot send a static bearer
  header to a remote server (Claude Desktop and friends).
- `VEYRA_TOOLS`: bundled tool definitions for frameworks that register tools
  without a network round-trip.
