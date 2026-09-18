import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VeyraClient,
  VeyraToolError,
  VeyraTransportError,
  idempotencyKey,
  VEYRA_TOOLS,
} from "../dist/index.js";
import { startMockVeyra } from "./mock-server.js";

test("rejects a credential that is not a Veyra token", () => {
  assert.throws(() => new VeyraClient({ token: "sk_live_nope" }), /veyra_/);
});

test("sends the bearer header and returns structured results", async () => {
  const mock = await startMockVeyra();
  try {
    const client = new VeyraClient({ token: "veyra_test", url: mock.url });
    const budget = await client.getBudget();
    assert.equal(budget.spent_today, "1.50");
    assert.equal(mock.requests[0].auth, "Bearer veyra_test");
  } finally {
    await mock.close();
  }
});

test("a wrong credential surfaces as a VeyraToolError with the server code", async () => {
  const mock = await startMockVeyra();
  try {
    const client = new VeyraClient({ token: "veyra_wrong", url: mock.url });
    await assert.rejects(
      () => client.getBudget(),
      (e) => e instanceof VeyraToolError && e.code === "UNKNOWN_CREDENTIAL",
    );
  } finally {
    await mock.close();
  }
});

test("createPayment defaults asset and network, and is idempotent", async () => {
  const mock = await startMockVeyra();
  try {
    const client = new VeyraClient({ token: "veyra_test", url: mock.url });
    const key = idempotencyKey("test");
    const first = await client.createPayment({
      amount: "1.00",
      recipient: "0x000000000000000000000000000000000000dEaD",
      reason: "unit test",
      idempotency_key: key,
    });
    assert.equal(first.asset, "USDC");
    assert.equal(first.network, "base");
    assert.equal(first.status, "confirmed_simulated");
    assert.equal(first.simulated, true);
    const again = await client.createPayment({
      amount: "1.00",
      recipient: "0x000000000000000000000000000000000000dEaD",
      reason: "unit test",
      idempotency_key: key,
    });
    assert.equal(again.payment_id, first.payment_id);
  } finally {
    await mock.close();
  }
});

test("an ask-band payment returns an approval link, and waitForPayment stops at the deadline", async () => {
  const mock = await startMockVeyra();
  try {
    const client = new VeyraClient({ token: "veyra_test", url: mock.url });
    const p = await client.createPayment({
      amount: "4.00",
      recipient: "0x000000000000000000000000000000000000dEaD",
      reason: "needs a human",
      idempotency_key: idempotencyKey(),
    });
    assert.equal(p.status, "awaiting_approval");
    assert.match(p.next_action.url, /\/approve\//);
    const settled = await client.waitForPayment(p.payment_id, {
      intervalMs: 10,
      timeoutMs: 50,
    });
    assert.equal(settled.status, "awaiting_approval");
  } finally {
    await mock.close();
  }
});

test("tool refusals throw VeyraToolError, both isError and plain-error shapes", async () => {
  const mock = await startMockVeyra();
  try {
    const client = new VeyraClient({ token: "veyra_test", url: mock.url });
    await assert.rejects(
      () =>
        client.createPayment({
          amount: "1",
          recipient: "0x0",
          reason: "x",
          idempotency_key: "short",
        }),
      (e) => e instanceof VeyraToolError && e.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      () => client.getPayment("pay_missing"),
      (e) => e instanceof VeyraToolError && e.code === "NOT_FOUND",
    );
  } finally {
    await mock.close();
  }
});

test("network failure is a VeyraTransportError", async () => {
  const client = new VeyraClient({
    token: "veyra_test",
    url: "http://127.0.0.1:1/api/mcp",
  });
  await assert.rejects(
    () => client.getBudget(),
    (e) => e instanceof VeyraTransportError,
  );
});

test("bundled tool definitions cover every tool name", () => {
  const names = VEYRA_TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "cancel_payment",
    "create_payment",
    "get_budget",
    "get_capabilities",
    "get_payment",
    "list_payment_sources",
    "list_payments",
  ]);
});
