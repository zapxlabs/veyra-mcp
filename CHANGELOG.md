# Changelog

## 0.1.1 — 2026-09-19

- **`paymentOutcome` and `movedRealMoney`.** The README used to show policy
  refusals being caught with `try`/`catch`. They are not exceptions — a blocked
  payment returns normally with `status: "failed"`, so that pattern read every
  refusal as a success. These collapse the statuses into one unambiguous label,
  and `movedRealMoney` is deliberately false for a simulated settlement.
- **`tx_ref` and `explorer_url`** on a settled payment: the on-chain
  transaction, for confirming a payment worked and proving it to the recipient.
  Null on the simulated rail.
- **`possible_duplicate_of`**, set when an identical payment to the same
  recipient is already live — the signal that you are retrying something that
  already worked.
- Tool descriptions synced with the hosted server: when to reach for
  `create_payment`, why never to retry out of uncertainty, and that a simulated
  approval is a click rather than a wallet signature.
- Fixed the `bin` path so `npx veyra-mcp` resolves.

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
