import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  api,
  AuthError,
  ConfigError,
  msToIso,
  PermissionError,
  pollForNewMessage,
  QuotaError,
} from "@moemail/core";

const EXPIRY_MAP: Record<string, number> = {
  "1h": 3600000,
  "24h": 86400000,
  "3d": 259200000,
  permanent: 0,
};

/** Cap a tool-level wait well below typical MCP client timeouts. */
const WAIT_MAX_SEC = 90;
const WAIT_DEFAULT_SEC = 60;

function errorText(e: unknown): string {
  if (e instanceof QuotaError) {
    const quota =
      e.monthlyLimit != null ? ` (used ${e.monthlyUsed ?? "?"}/${e.monthlyLimit} this month)` : "";
    return `Monthly API quota exceeded${quota}: ${e.message}`;
  }
  if (e instanceof PermissionError) return `Permission denied: ${e.message}`;
  if (e instanceof AuthError) return `Authentication failed: ${e.message}`;
  if (e instanceof ConfigError) return `Configuration error: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Run a tool body, mapping thrown core errors to an isError result. */
async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    return { content: [{ type: "text", text: errorText(e) }], isError: true };
  }
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "create_email",
    {
      title: "Create temporary email",
      description:
        "Create a temporary email address. Returns its id and address. Use the id for all later operations.",
      inputSchema: {
        name: z.string().optional().describe("Email prefix (random if omitted)"),
        domain: z.string().optional().describe("Email domain (first configured domain if omitted)"),
        expiry: z
          .enum(["1h", "24h", "3d", "permanent"])
          .default("1h")
          .describe("Lifetime of the mailbox"),
      },
    },
    ({ name, domain, expiry }) =>
      run(async () => {
        const expiryTime = EXPIRY_MAP[expiry];

        let resolvedDomain: string;
        if (domain) {
          resolvedDomain = domain;
        } else {
          const config = (await api.getConfig()) as any;
          const domains: string[] =
            config.emailDomains?.split(",").map((d: string) => d.trim()) ?? [];
          if (!domains.length) {
            throw new Error("No email domains configured on server. Pass `domain` explicitly.");
          }
          resolvedDomain = domains[0];
        }

        const result = (await api.createEmail({ name, expiryTime, domain: resolvedDomain })) as any;
        const expiresAt = expiryTime === 0 ? null : msToIso(Date.now() + expiryTime);
        return ok({ id: result.id, address: result.email, expiresAt });
      }),
  );

  server.registerTool(
    "list_emails",
    {
      title: "List mailboxes",
      description: "List temporary mailboxes owned by this API key.",
      inputSchema: {
        cursor: z.string().optional().describe("Pagination cursor from a previous call"),
      },
    },
    ({ cursor }) =>
      run(async () => {
        const data = (await api.listEmails(cursor)) as any;
        return ok({
          emails: data.emails.map((e: any) => ({
            id: e.id,
            address: e.address,
            expiresAt: e.expiresAt || null,
          })),
          nextCursor: data.nextCursor,
          total: data.total,
        });
      }),
  );

  server.registerTool(
    "list_messages",
    {
      title: "List messages",
      description: "List messages received in a mailbox (newest first).",
      inputSchema: {
        emailId: z.string().describe("Mailbox id from create_email"),
        cursor: z.string().optional().describe("Pagination cursor from a previous call"),
      },
    },
    ({ emailId, cursor }) =>
      run(async () => {
        const data = (await api.listMessages(emailId, cursor)) as any;
        return ok({
          messages: data.messages.map((m: any) => ({
            id: m.id,
            from: m.from_address,
            subject: m.subject,
            receivedAt: m.received_at ? msToIso(m.received_at) : null,
          })),
          nextCursor: data.nextCursor,
          total: data.total,
        });
      }),
  );

  server.registerTool(
    "read_message",
    {
      title: "Read message",
      description: "Read the full content (text + html) of a single message.",
      inputSchema: {
        emailId: z.string().describe("Mailbox id"),
        messageId: z.string().describe("Message id from list_messages or wait_for_email"),
      },
    },
    ({ emailId, messageId }) =>
      run(async () => {
        const data = (await api.getMessage(emailId, messageId)) as any;
        const msg = data.message;
        return ok({
          id: msg.id,
          from: msg.from_address,
          to: msg.to_address,
          subject: msg.subject,
          content: msg.content,
          html: msg.html,
          receivedAt: msg.received_at ? msToIso(msg.received_at) : null,
          type: msg.type,
        });
      }),
  );

  server.registerTool(
    "wait_for_email",
    {
      title: "Wait for a new email",
      description:
        `Poll a mailbox until a new message arrives or the timeout elapses (max ${WAIT_MAX_SEC}s). ` +
        `On timeout this returns { status: "timeout" } instead of failing — call it again to keep waiting.`,
      inputSchema: {
        emailId: z.string().describe("Mailbox id to watch"),
        timeoutSec: z
          .number()
          .int()
          .min(1)
          .max(WAIT_MAX_SEC)
          .default(WAIT_DEFAULT_SEC)
          .describe(`Max seconds to wait (<= ${WAIT_MAX_SEC})`),
        intervalSec: z.number().int().min(1).max(30).default(5).describe("Seconds between polls"),
      },
    },
    ({ emailId, timeoutSec, intervalSec }) =>
      run(async () => {
        const result = await pollForNewMessage(emailId, {
          timeoutMs: Math.min(timeoutSec, WAIT_MAX_SEC) * 1000,
          intervalMs: intervalSec * 1000,
        });

        if (result.status === "timeout") {
          return ok({
            status: "timeout",
            elapsedSec: result.elapsedSec,
            hint: "No new message yet. Call wait_for_email again to continue waiting.",
          });
        }

        const msg = result.message!;
        return ok({
          status: "received",
          elapsedSec: result.elapsedSec,
          message: {
            messageId: msg.id,
            from: msg.from_address,
            subject: msg.subject,
            receivedAt: msg.received_at ? msToIso(msg.received_at) : null,
          },
        });
      }),
  );

  server.registerTool(
    "send_email",
    {
      title: "Send email",
      description: "Send an email from a temporary address (requires send permission on the server).",
      inputSchema: {
        emailId: z.string().describe("Mailbox id to send from"),
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        content: z.string().describe("Email body text"),
      },
    },
    ({ emailId, to, subject, content }) =>
      run(async () => {
        const result = (await api.sendEmail(emailId, { to, subject, content })) as any;
        return ok({ success: true, remainingEmails: result.remainingEmails });
      }),
  );

  server.registerTool(
    "delete_email",
    {
      title: "Delete mailbox",
      description: "Delete an entire temporary mailbox and all its messages.",
      inputSchema: {
        emailId: z.string().describe("Mailbox id to delete"),
      },
    },
    ({ emailId }) =>
      run(async () => {
        await api.deleteEmail(emailId);
        return ok({ success: true, deleted: emailId });
      }),
  );

  server.registerTool(
    "delete_message",
    {
      title: "Delete message",
      description: "Delete a single message from a mailbox.",
      inputSchema: {
        emailId: z.string().describe("Mailbox id"),
        messageId: z.string().describe("Message id to delete"),
      },
    },
    ({ emailId, messageId }) =>
      run(async () => {
        await api.deleteMessage(emailId, messageId);
        return ok({ success: true, deleted: messageId });
      }),
  );
}
