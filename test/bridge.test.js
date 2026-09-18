import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startMockVeyra } from "./mock-server.js";
import { VEYRA_TOOLS } from "../dist/index.js";

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

/** Drive the bridge binary over stdio like an MCP host would. */
function startBridge(env) {
  const child = spawn(process.execPath, [bin], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  const pending = new Map();
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg);
      }
    }
  });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c.toString()));
  let id = 0;
  return {
    request(method, params = {}) {
      const msgId = ++id;
      return new Promise((resolve) => {
        pending.set(msgId, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: msgId, method, params }) + "\n");
      });
    },
    notify(method, params = {}) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    },
    stderr: () => stderr,
    close: () =>
      new Promise((resolve) => {
        child.on("exit", resolve);
        child.kill();
      }),
  };
}

test("bin exits with usage when no credential is given", async () => {
  const child = spawn(process.execPath, [bin], {
    env: { ...process.env, VEYRA_TOKEN: "" },
  });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));
  const code = await new Promise((r) => child.on("exit", r));
  assert.equal(code, 2);
  assert.match(stderr, /VEYRA_TOKEN/);
});

test("bridge relays initialize, tools/list and tools/call to the remote", async () => {
  const mock = await startMockVeyra({ tools: [...VEYRA_TOOLS] });
  const bridge = startBridge({ VEYRA_TOKEN: "veyra_test", VEYRA_MCP_URL: mock.url });
  try {
    const init = await bridge.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    assert.equal(init.result.serverInfo.name, "veyra");
    bridge.notify("notifications/initialized");

    const list = await bridge.request("tools/list");
    assert.equal(list.result.tools.length, VEYRA_TOOLS.length);

    const call = await bridge.request("tools/call", {
      name: "get_budget",
      arguments: {},
    });
    assert.equal(call.result.structuredContent.daily_limit, "25");
    assert.equal(call.result.isError, undefined);

    const bad = await bridge.request("tools/call", {
      name: "get_payment",
      arguments: { payment_id: "pay_missing" },
    });
    assert.equal(bad.result.isError, true);
    assert.equal(bad.result.structuredContent.error, "NOT_FOUND");

    // The remote saw the bearer header; the host never had to send it.
    assert.ok(mock.requests.every((r) => r.auth === "Bearer veyra_test"));
  } finally {
    await bridge.close();
    await mock.close();
  }
});
