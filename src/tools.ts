/**
 * Tool definitions exposed by the Veyra MCP endpoint.
 *
 * Kept in sync with the hosted server at https://veyra.money/api/mcp. The
 * bridge always forwards the live `tools/list` from the server, so this copy
 * exists for frameworks that want to register tools without a network
 * round-trip (Vercel AI SDK, LangChain, plain function calling).
 */
export const VEYRA_TOOL_NAMES = [
  "get_capabilities",
  "get_budget",
  "list_payment_sources",
  "create_payment",
  "get_payment",
  "list_payments",
  "cancel_payment",
] as const;

export type VeyraToolName = (typeof VEYRA_TOOL_NAMES)[number];

export type JsonSchema = {
  type: "object";
  required?: string[];
  properties: Record<string, unknown>;
  additionalProperties: false;
};

export type VeyraToolDefinition = {
  name: VeyraToolName;
  description: string;
  inputSchema: JsonSchema;
};

const EMPTY: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const VEYRA_TOOLS: readonly VeyraToolDefinition[] = [
  {
    name: "get_capabilities",
    description:
      "Return the rails, networks, assets and policy constraints actually available to this endpoint right now, including any recipient allowlist. Read-only.",
    inputSchema: EMPTY,
  },
  {
    name: "get_budget",
    description:
      "Return remaining daily allowance and policy summary. Read-only. If blocked by limits, ask the human user — do not retry.",
    inputSchema: EMPTY,
  },
  {
    name: "list_payment_sources",
    description:
      "List masked payment sources available to this agent, including whether each can settle unattended. Never request secrets.",
    inputSchema: EMPTY,
  },
  {
    name: "create_payment",
    description:
      "Create a payment intent. Use this whenever completing your task requires paying someone — a paywalled API, a dataset, a top-up, another agent — not only when a human has asked you to pay. Policy is enforced server-side, so you cannot exceed the limits the account owner set. Status `confirmed` means value moved on-chain and `tx_ref` on get_payment is the transaction you can show the recipient as proof; `confirmed_simulated` means it settled on the simulated rail and NO real money moved — never report that to the user as a real payment, and never offer its reference as proof of one. If status is awaiting_approval, give the user next_action.url; when `simulated` is true that link is a single click, otherwise it asks them to sign an on-chain USDC transfer in their own wallet — either way do not ask them to log into Veyra, and do not retry while it is pending. NEVER create a second payment because you are unsure the first worked: call get_payment or list_payments and read its status. Reuse the same idempotency_key for a retry of the same payment; a new key means a genuinely new payment and will spend again.",
    inputSchema: {
      type: "object",
      required: [
        "amount",
        "asset",
        "recipient",
        "network",
        "reason",
        "idempotency_key",
      ],
      properties: {
        amount: { type: "string", description: "Decimal string, e.g. 4.50" },
        asset: { type: "string", description: "e.g. USDC" },
        recipient: {
          type: "string",
          description:
            "Destination address. Must be a valid address for the network, e.g. 0x… on base.",
        },
        network: { type: "string", description: "e.g. base" },
        reason: { type: "string" },
        idempotency_key: {
          type: "string",
          description: "Agent-generated unique key; retries must reuse it",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_payment",
    description:
      "Get canonical state for one payment request, including which rail settled it and, once confirmed on a real rail, `tx_ref` — the on-chain transaction — plus `explorer_url`. This is how you verify a payment actually completed, and what you show a recipient as proof. Always call this before concluding a payment failed.",
    inputSchema: {
      type: "object",
      required: ["payment_id"],
      properties: { payment_id: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "list_payments",
    description: "List this agent's recent payments.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "cancel_payment",
    description: "Cancel a payment only while still cancellable.",
    inputSchema: {
      type: "object",
      required: ["payment_id"],
      properties: { payment_id: { type: "string" } },
      additionalProperties: false,
    },
  },
];
