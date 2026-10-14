import { Command } from "commander";
import { msToIso, pollForNewMessage } from "@moemail/core";
import { fail, log, printJson, printText } from "../output.js";

export function registerWaitCommand(program: Command) {
  program
    .command("wait")
    .description("Wait for a new email to arrive")
    .requiredOption("--email-id <id>", "email ID to watch")
    .option("--timeout <seconds>", "max wait time in seconds", "120")
    .option("--interval <seconds>", "poll interval in seconds", "5")
    .action(async (opts) => {
      const json = program.opts().json;
      const timeout = parseInt(opts.timeout, 10);
      const interval = parseInt(opts.interval, 10);

      try {
        const result = await pollForNewMessage(opts.emailId, {
          timeoutMs: timeout * 1000,
          intervalMs: interval * 1000,
          onTick: (elapsed) => log(`Polling... (${elapsed}/${timeout}s)`),
        });

        if (result.status === "timeout") {
          log(`Timeout: no new messages received within ${timeout}s`);
          process.exit(1);
        }

        const msg = result.message!;
        if (json) {
          printJson({
            messageId: msg.id,
            from: msg.from_address,
            subject: msg.subject,
            receivedAt: msg.received_at ? msToIso(msg.received_at) : null,
          });
        } else {
          printText(`New message from ${msg.from_address}: "${msg.subject}"`);
          printText(`Message ID: ${msg.id}`);
        }
      } catch (e) {
        fail(e);
      }
    });
}
