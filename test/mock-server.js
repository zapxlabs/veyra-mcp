import { createServer } from "node:http";

/**
 * A tiny stand-in for https://veyra.money/api/mcp that speaks the same
 * JSON-RPC shape. Records every request so tests can assert on headers.
 */
export function startMockVeyra({ token = "veyra_test", tools = [] } = {}) {
  const requests = [];
  const payments = new Map();
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const auth = req.headers.authorization ?? "";
      requests.push({ auth, body });
      const reply = (status, json) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(json));
      };
      if (auth !== `Bearer ${token}`) {
        return reply(401, {
          error: "UNKNOWN_CREDENTIAL",
          message: "Credential not recognised.",
        });
      }
      const msg = JSON.parse(body);
      const ok = (result) => reply(200, { jsonrpc: "2.0", id: msg.id ?? null, result });
      switch (msg.method) {
        case "initialize":
          return ok({
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "veyra", version: "0.1.0" },
          });
        case "tools/list":
          return ok({ tools });
        case "tools/call": {
          const { name, arguments: args = {} } = msg.params;
          const wrap = (result, isError = false) =>
            ok({
              isError,
              content: [{ type: "text", text: JSON.stringify(result) }],
              structuredContent: result,
            });
          if (name === "get_budget") {
            return wrap({
              daily_limit: "25",
              spent_today: "1.50",
              per_tx_limit: "5",
              auto_max: "2",
              ask_max: "5",
            });
          }
          if (name === "create_payment") {
            if (!args.idempotency_key || args.idempotency_key.length < 8) {
              return wrap(
                {
                  error: "VALIDATION_ERROR",
                  message: "Invalid arguments: idempotency_key.",
                },
                true,
              );
            }
            const existing = [...payments.values()].find(
              (p) => p.key === args.idempotency_key,
            );
            if (existing) return wrap(existing.view);
            const id = `pay_${payments.size + 1}`;
            const big = Number(args.amount) > 2;
            const view = {
              payment_id: id,
              policy_decision: big ? "ask" : "auto_approved",
              status: big ? "awaiting_approval" : "confirmed_simulated",
              amount: args.amount,
              asset: args.asset,
              recipient: args.recipient,
              network: args.network,
              reason: args.reason,
              rail: big ? null : "mock",
              simulated: !big,
              source: { id: "src_1" },
              next_action: big ? { url: `https://veyra.money/approve/${id}` } : null,
              approval_expires_at: null,
              policy_reason: null,
            };
            payments.set(id, { key: args.idempotency_key, view });
            return wrap(view);
          }
          if (name === "get_payment") {
            const p = payments.get(args.payment_id);
            return p
              ? wrap(p.view)
              : wrap({ error: "NOT_FOUND", message: "No payment with that id." });
          }
          return wrap({ error: "UNKNOWN_TOOL", message: `Unknown tool ${name}.` });
        }
        default:
          return reply(200, {
            jsonrpc: "2.0",
            id: msg.id ?? null,
            error: { code: -32601, message: `Method not found: ${msg.method}` },
          });
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/api/mcp`,
        requests,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
