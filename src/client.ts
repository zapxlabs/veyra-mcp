import type { VeyraToolDefinition, VeyraToolName } from "./tools.js";

export const DEFAULT_VEYRA_MCP_URL = "https://veyra.money/api/mcp";

/** Every state a payment can report to an agent. */
export type PaymentStatus =
  | "pending"
  | "awaiting_approval"
  | "submitted"
  | "confirmed"
  | "confirmed_simulated"
  | "failed"
  | "cancelled"
  | "expired";

export type PaymentView = {
  payment_id: string;
  policy_decision: string | null;
  status: PaymentStatus | string;
  amount: string;
  asset: string;
  recipient: string | null;
  network: string | null;
  reason: string;
  /** "mock" | "onchain" | "wallet" — null until something has executed. */
  rail: string | null;
  /** True when the simulated rail settled it: nothing moved on any chain. */
  simulated: boolean;
  source: { id: string } | null;
  /** Present while awaiting approval: the one-time wallet-approval link. */
  next_action: { url?: string; expires_at?: string; [k: string]: unknown } | null;
  approval_expires_at: string | null;
  policy_reason: string | null;
  /**
   * The on-chain transaction, once a payment has settled on a real rail.
   * Null while pending, and null on the simulated rail — its reference is not
   * a chain transaction and must never be shown as proof that money moved.
   */
  tx_ref?: string | null;
  explorer_url?: string | null;
  /**
   * Set when an identical payment to the same recipient was created minutes
   * ago and is still live. You are probably retrying something that already
   * worked — read that payment before creating another.
   */
  possible_duplicate_of?: string | null;
};

export type Capabilities = {
  rails: string[];
  assets: string[];
  networks: string[];
  execution_modes: string[];
  allowed_recipients: string[];
  constraints: {
    per_tx_limit: string;
    daily_limit: string;
    auto_max: string;
    ask_max: string;
  } | null;
};

export type Budget = {
  daily_limit: string;
  spent_today: string;
  per_tx_limit: string;
  auto_max: string;
  ask_max: string;
};

export type PaymentSource = {
  id: string;
  provider: string;
  masked_ref: string;
  execution_mode: string;
  capabilities: unknown;
  unattended: {
    available: boolean;
    rail: string;
    simulated: boolean;
    allowance_cap?: string | null;
    allowance_network?: string | null;
  };
};

export type CreatePaymentInput = {
  /** Decimal string, e.g. "4.50". */
  amount: string;
  /** Currently "USDC". */
  asset?: string;
  /** Destination address, e.g. 0x… on Base. */
  recipient: string;
  /** Currently "base". */
  network?: string;
  /** Human-readable reason; shown to the owner on approval. */
  reason: string;
  /** Unique per logical payment; reuse it on retries, never for a new payment. */
  idempotency_key: string;
};

/**
 * Veyra refused to process the call at all: a malformed argument, a
 * credential it does not recognise, a payment id that isn't yours.
 *
 * Note what is *not* in that list. A payment the policy declines is not an
 * error — the call did exactly what it was asked and the answer was no, so it
 * comes back as an ordinary result with `status: "failed"` and a
 * `policy_reason`. Reaching for try/catch to detect refusals therefore misses
 * every blocked payment and reads it as a success. Use `paymentOutcome` or
 * `movedRealMoney` below.
 */
export class VeyraToolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "VeyraToolError";
    this.code = code;
  }
}

/** The transport failed: HTTP error, rate limit, malformed reply. */
export class VeyraTransportError extends Error {
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  constructor(
    message: string,
    status: number | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "VeyraTransportError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type VeyraClientOptions = {
  /** Endpoint credential from the Veyra dashboard. Starts with `veyra_`. */
  token: string;
  /** Override for self-hosted or staging deployments. */
  url?: string;
  /** Custom fetch, e.g. for tests or instrumentation. */
  fetch?: typeof fetch;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

type ToolCallResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
};

/**
 * Minimal typed client for the Veyra MCP endpoint.
 *
 * It speaks the same JSON-RPC the MCP transport uses, so there is nothing to
 * keep in sync with a second REST surface, and it works anywhere `fetch` does
 * (Node 18+, Bun, Deno, edge runtimes, browsers).
 */
export class VeyraClient {
  readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;

  constructor(options: VeyraClientOptions) {
    if (!options.token?.startsWith("veyra_")) {
      throw new Error(
        "VeyraClient needs an endpoint credential starting with `veyra_` (create one at https://veyra.money/dashboard).",
      );
    }
    this.token = options.token;
    this.url = options.url ?? DEFAULT_VEYRA_MCP_URL;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("No fetch available; pass one via options.fetch.");
    }
  }

  /** Raw JSON-RPC request. Prefer the typed helpers below. */
  async rpc<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = this.nextId++;
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
    } catch (e) {
      throw new VeyraTransportError(
        `Could not reach ${this.url}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (res.status === 401) {
      const body = (await safeJson(res)) as { error?: string; message?: string } | null;
      throw new VeyraToolError(
        body?.error ?? "UNAUTHORIZED",
        body?.message ?? "Credential rejected by Veyra.",
      );
    }
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      throw new VeyraTransportError(
        "Rate limited by Veyra. Back off before retrying.",
        429,
        Number.isFinite(retry) ? retry : null,
      );
    }
    if (!res.ok) {
      throw new VeyraTransportError(
        `Veyra responded ${res.status} ${res.statusText}`,
        res.status,
      );
    }

    const json = (await safeJson(res)) as JsonRpcResponse | null;
    if (!json || json.jsonrpc !== "2.0") {
      throw new VeyraTransportError("Malformed JSON-RPC response from Veyra.", res.status);
    }
    if (json.error) {
      throw new VeyraTransportError(
        `JSON-RPC error ${json.error.code}: ${json.error.message}`,
        res.status,
      );
    }
    return json.result as T;
  }

  /** Live tool list from the server. */
  async listTools(): Promise<VeyraToolDefinition[]> {
    const result = await this.rpc<{ tools: VeyraToolDefinition[] }>("tools/list");
    return result.tools;
  }

  /**
   * Call any tool and get its structured result. Throws `VeyraToolError` when
   * the server reports a deliberate refusal (policy, validation, not found).
   */
  async callTool<T = unknown>(
    name: VeyraToolName | string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await this.rpc<ToolCallResult>("tools/call", {
      name,
      arguments: args,
    });
    const structured =
      result.structuredContent ?? parseTextContent(result.content) ?? null;
    if (result.isError) {
      const err = (structured ?? {}) as { error?: string; message?: string };
      throw new VeyraToolError(
        err.error ?? "TOOL_ERROR",
        err.message ?? "Veyra refused the call.",
      );
    }
    // Some refusals (e.g. NOT_FOUND, UNKNOWN_TOOL) come back as a plain
    // result with an `error` field rather than isError.
    if (
      structured &&
      typeof structured === "object" &&
      "error" in structured &&
      typeof (structured as { error: unknown }).error === "string" &&
      Object.keys(structured as object).every((k) => k === "error" || k === "message")
    ) {
      const err = structured as { error: string; message?: string };
      throw new VeyraToolError(err.error, err.message ?? err.error);
    }
    return structured as T;
  }

  getCapabilities() {
    return this.callTool<Capabilities>("get_capabilities");
  }

  getBudget() {
    return this.callTool<Budget>("get_budget");
  }

  async listPaymentSources() {
    const r = await this.callTool<{ sources: PaymentSource[] }>("list_payment_sources");
    return r.sources;
  }

  createPayment(input: CreatePaymentInput) {
    return this.callTool<PaymentView>("create_payment", {
      amount: input.amount,
      asset: input.asset ?? "USDC",
      recipient: input.recipient,
      network: input.network ?? "base",
      reason: input.reason,
      idempotency_key: input.idempotency_key,
    });
  }

  getPayment(paymentId: string) {
    return this.callTool<PaymentView>("get_payment", { payment_id: paymentId });
  }

  async listPayments(limit?: number) {
    const r = await this.callTool<{ payments: PaymentView[] }>(
      "list_payments",
      limit === undefined ? {} : { limit },
    );
    return r.payments;
  }

  cancelPayment(paymentId: string) {
    return this.callTool<PaymentView>("cancel_payment", { payment_id: paymentId });
  }

  /**
   * Poll a payment until it leaves `pending` / `awaiting_approval` /
   * `submitted`, or until `timeoutMs` elapses (then the last view is returned).
   */
  async waitForPayment(
    paymentId: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<PaymentView> {
    const interval = opts.intervalMs ?? 3000;
    const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60_000);
    let view = await this.getPayment(paymentId);
    while (
      ["pending", "awaiting_approval", "submitted"].includes(view.status) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, interval));
      view = await this.getPayment(paymentId);
    }
    return view;
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function parseTextContent(content: ToolCallResult["content"]): unknown {
  const text = content?.find((c) => c.type === "text")?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

/** Generate an idempotency key: a stable prefix plus enough entropy. */
export function idempotencyKey(prefix = "pay"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

/**
 * What actually happened to a payment, as one unambiguous label.
 *
 * Reading `status` directly is easy to get subtly wrong in the two ways that
 * matter: `confirmed_simulated` looks like success but moved nothing, and a
 * policy refusal arrives as a plain `failed` rather than a thrown error. Both
 * mistakes fail in the same direction — telling a user money moved when it
 * did not.
 */
export type PaymentOutcome =
  | "settled"
  | "simulated"
  | "awaiting_approval"
  | "blocked"
  | "in_progress"
  | "failed"
  | "cancelled"
  | "expired";

export function paymentOutcome(payment: PaymentView): PaymentOutcome {
  if (payment.status === "confirmed") return "settled";
  if (payment.status === "confirmed_simulated") return "simulated";
  if (payment.status === "awaiting_approval") return "awaiting_approval";
  if (payment.status === "cancelled") return "cancelled";
  if (payment.status === "expired") return "expired";
  if (payment.status === "failed") {
    return payment.policy_decision === "blocked" ? "blocked" : "failed";
  }
  return "in_progress";
}

/**
 * The only check that should gate telling a human that value moved.
 *
 * Deliberately strict: a simulated settlement returns false even though its
 * status begins with "confirmed", because the whole point of the simulated
 * rail is that nothing left anyone's wallet.
 */
export function movedRealMoney(payment: PaymentView): boolean {
  return payment.status === "confirmed" && payment.rail !== "mock";
}

/** True while the payment can still change state on its own. */
export function isPending(payment: PaymentView): boolean {
  return (
    payment.status === "pending" ||
    payment.status === "submitted" ||
    payment.status === "awaiting_approval"
  );
}
