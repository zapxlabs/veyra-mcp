import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_VEYRA_MCP_URL, VeyraClient, VeyraToolError, VeyraTransportError } from "./client.js";
import { VEYRA_TOOLS } from "./tools.js";

export type BridgeOptions = {
  token: string;
  url?: string;
  fetch?: typeof fetch;
};

/**
 * Builds a stdio MCP server that forwards every tool call to the hosted
 * Veyra endpoint. Exists for clients that cannot send a static bearer header
 * to a remote server (Claude Desktop's connector UI, older MCP hosts).
 *
 * No policy lives here. The bridge holds the credential and relays; every
 * limit is still enforced by Veyra's server.
 */
export function createBridgeServer(options: BridgeOptions) {
  const client = new VeyraClient(options);
  const server = new Server(
    { name: "veyra", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: await client.listTools() };
    } catch (e) {
      // Fall back to the bundled definitions so the host can still render the
      // tools; the next call will surface the real error.
      if (e instanceof VeyraTransportError) return { tools: [...VEYRA_TOOLS] };
      throw e;
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await client.callTool(name, args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    } catch (e) {
      const payload =
        e instanceof VeyraToolError
          ? { error: e.code, message: e.message }
          : e instanceof VeyraTransportError
            ? {
                error: "TRANSPORT_ERROR",
                message: e.message,
                ...(e.retryAfterSeconds ? { retry_after_seconds: e.retryAfterSeconds } : {}),
              }
            : {
                error: "INTERNAL_ERROR",
                message: e instanceof Error ? e.message : String(e),
              };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }
  });

  return server;
}

export async function runBridge(options: BridgeOptions) {
  const server = createBridgeServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const url = options.url ?? DEFAULT_VEYRA_MCP_URL;
  // stderr only: stdout is the MCP channel.
  process.stderr.write(`veyra-mcp: bridging stdio → ${url}\n`);
  return server;
}
