import { api } from "./api.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NewMessage {
  id: string;
  from_address: string;
  subject: string;
  received_at?: number;
}

export interface PollResult {
  status: "received" | "timeout";
  message?: NewMessage;
  elapsedSec: number;
}

/**
 * Poll a mailbox until a message that wasn't present at the start arrives, or
 * the timeout elapses. Transport-agnostic: the CLI wraps it with stderr
 * progress, the MCP server returns the result as structured JSON.
 *
 * On timeout this resolves with `status: "timeout"` rather than throwing, so an
 * MCP client can simply call the tool again to keep waiting.
 */
export async function pollForNewMessage(
  emailId: string,
  opts: {
    timeoutMs: number;
    intervalMs: number;
    onTick?: (elapsedSec: number) => void;
  },
): Promise<PollResult> {
  const initial = (await api.listMessages(emailId)) as any;
  const knownIds = new Set<string>(initial.messages.map((m: any) => m.id));

  const startTime = Date.now();

  while (true) {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    if (elapsedSec >= opts.timeoutMs / 1000) {
      return { status: "timeout", elapsedSec };
    }

    opts.onTick?.(elapsedSec);
    await sleep(opts.intervalMs);

    const current = (await api.listMessages(emailId)) as any;
    const fresh = current.messages.filter((m: any) => !knownIds.has(m.id));
    if (fresh.length > 0) {
      return {
        status: "received",
        message: fresh[0],
        elapsedSec: Math.floor((Date.now() - startTime) / 1000),
      };
    }
  }
}
