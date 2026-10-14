# @moemail/mcp

MCP (Model Context Protocol) server for [MoeMail](https://moemail.app) — gives any
MCP-capable agent (Claude Desktop, Cursor, Cline, …) native tools for temporary
email: create a mailbox, wait for a verification email, read it, send, and clean up.

It shares the same HTTP client and config as `@moemail/cli` via `@moemail/core`, so
it talks to the exact same MoeMail API (authenticated with an `X-API-Key`).

## Tools

| Tool | Description |
|------|-------------|
| `create_email` | Create a temporary mailbox (`expiry`: `1h` / `24h` / `3d` / `permanent`) |
| `list_emails` | List mailboxes owned by the API key |
| `list_messages` | List messages in a mailbox |
| `read_message` | Read full text/HTML of a message |
| `wait_for_email` | Poll for a new message (bounded, max 90s; returns `status: "timeout"` to retry) |
| `send_email` | Send from a temporary address (needs send permission) |
| `delete_email` | Delete a mailbox |
| `delete_message` | Delete a single message |

## Configuration

The server reads credentials from environment variables:

- `MOEMAIL_API_KEY` (required) — your MoeMail API key
- `MOEMAIL_API_URL` (optional) — defaults to `https://moemail.app`

## Usage

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "moemail": {
      "command": "npx",
      "args": ["-y", "@moemail/mcp"],
      "env": {
        "MOEMAIL_API_KEY": "mk_xxx",
        "MOEMAIL_API_URL": "https://moemail.app"
      }
    }
  }
}
```

## Notes

- API keys authenticate against `/api/emails*` and `/api/config*` — the same surface
  the CLI uses.
- Authentication, permission, and rate-limit failures from the server are surfaced as
  descriptive tool errors rather than generic failures.
