#!/usr/bin/env node
import { runBridge } from "./bridge.js";
import { DEFAULT_VEYRA_MCP_URL } from "./client.js";

const HELP = `veyra-mcp — stdio bridge to the Veyra MCP endpoint

Usage:
  VEYRA_TOKEN=veyra_... npx veyra-mcp
  npx veyra-mcp --token veyra_... [--url ${DEFAULT_VEYRA_MCP_URL}]

Environment:
  VEYRA_TOKEN     Endpoint credential from https://veyra.money/dashboard (required)
  VEYRA_MCP_URL   Override the endpoint (default ${DEFAULT_VEYRA_MCP_URL})

Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "veyra": {
        "command": "npx",
        "args": ["-y", "veyra-mcp"],
        "env": { "VEYRA_TOKEN": "veyra_..." }
      }
    }
  }
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}

const token = arg("--token") ?? process.env.VEYRA_TOKEN;
const url = arg("--url") ?? process.env.VEYRA_MCP_URL;

if (!token) {
  process.stderr.write(
    "veyra-mcp: missing credential. Set VEYRA_TOKEN or pass --token.\n\n" + HELP,
  );
  process.exit(2);
}

runBridge({ token, url }).catch((e) => {
  process.stderr.write(`veyra-mcp: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
