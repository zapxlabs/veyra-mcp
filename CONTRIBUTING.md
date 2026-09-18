# Contributing

Issues and pull requests are welcome.

- **Bugs in the bridge or client** belong here.
- **Bugs in the hosted service** (policy decisions, approvals, settlement)
  should be reported from the dashboard at https://veyra.money, or by email to
  support@veyra.money, so they reach the people who can act on them and don't
  put account details in a public issue.
- **Security issues**: see [SECURITY.md](SECURITY.md). Please don't open a
  public issue for anything that could move money.

## Developing

```bash
npm install
npm test        # builds, then runs node --test against a mock endpoint
```

The tests never touch https://veyra.money. To exercise the real endpoint, set
`VEYRA_TOKEN` to a credential from a **simulated** source and run:

```bash
VEYRA_TOKEN=veyra_... node dist/bin.js
```

then speak JSON-RPC to it on stdin, or point an MCP host at it.

## Style

Small, typed, no runtime dependencies beyond the MCP SDK. If a change needs a
new dependency, say why in the pull request.
