/**
 * AgentMail delivery primitive for the scheduled report Edge Function.
 *
 * Dependency-free on purpose: this file is imported by the Deno Edge
 * Function AND unit-tested under Jest, so it must not import npm
 * packages, Deno APIs, or app modules. The HTTP layer is injected, so
 * tests drive every provider outcome without touching the network.
 *
 * The API key always arrives as a function argument from the server
 * environment (Edge Function secret). It is never read from app config,
 * never logged, and never stored — it only travels in the Authorization
 * header of the single outbound request.
 */

export const AGENTMAIL_SEND_URL = 'https://api.agentmail.ai/v1/emails';

export interface OutboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface EmailDeliveryResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Minimal fetch surface: Deno's global fetch satisfies this structurally. */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * Send one email via AgentMail. Never throws: network faults, provider
 * rejections, and malformed payloads all come back as `{ ok: false }`
 * with a key-safe error string (status codes only — no bodies, no keys).
 */
export async function sendViaAgentMail(
  fetchImpl: FetchLike,
  apiKey: string,
  email: OutboundEmail,
): Promise<EmailDeliveryResult> {
  let response: { ok: boolean; status: number; json: () => Promise<unknown> };
  try {
    response = await fetchImpl(AGENTMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
    });
  } catch (error) {
    return { ok: false, error: `network: ${String(error)}` };
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    return { ok: false, error: `provider ${response.status}` };
  }
  const messageId =
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    typeof (payload as { id: unknown }).id === 'string'
      ? (payload as { id: string }).id
      : undefined;
  return { ok: true, messageId };
}
