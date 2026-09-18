# Security

Veyra sits between AI agents and real money, so we treat reports seriously.

**Please email security@veyra.money** instead of opening a public issue for
anything that could let an agent exceed its policy, move funds to an
unintended recipient, read another account's data, or bypass an approval.

What to include: the endpoint or code path, steps to reproduce, and the impact
you believe it has. We will acknowledge within two business days.

## Scope notes

- This repository holds the client and the stdio bridge. Neither enforces
  policy; every limit is enforced by the hosted service. A bug here can leak a
  credential or mis-report a status, but cannot widen what an endpoint may
  spend.
- The credential (`veyra_…`) is a bearer token. Treat it like an API key:
  rotate it from the dashboard if it is ever pasted somewhere public.
