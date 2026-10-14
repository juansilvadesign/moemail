---
name: moemail
description: Use when working in this repository and an AI agent needs a temporary/disposable email address through the MoeMail CLI.
---

# MoeMail for This Repository

## When to use

Use this skill when you are inside the `moemail` repository and need to create inboxes, wait for messages, read message content, or send test emails with the MoeMail CLI.

## Install

Install the MoeMail CLI globally when it is not already available:

```bash
npm i -g @moemail/cli
```

Then confirm the binary is available:

```bash
moemail --help
```

## Preferred CLI

Prefer the installed `moemail` CLI when it is available:

```bash
CLI="moemail"
```

If the global CLI is unavailable and you are working inside this repository, fall back to the repo-local build:

```bash
CLI="node packages/cli/dist/index.js"
```

If `packages/cli/dist/index.js` is missing or stale, rebuild it first:

```bash
(cd packages/cli && bun run build)
```

## Setup

For local development against this repository:

```bash
$CLI config set api-url http://localhost:3000
$CLI config set api-key YOUR_API_KEY
```

For the hosted service, use `https://moemail.app` instead.

You can also use environment variables: `MOEMAIL_API_URL`, `MOEMAIL_API_KEY`.

## Core workflow

```bash
RESULT=$($CLI --json create --expiry 1h)
ID=$(echo "$RESULT" | jq -r '.id')
EMAIL=$(echo "$RESULT" | jq -r '.address')

MSG=$($CLI --json wait --email-id "$ID" --timeout 120)
MSG_ID=$(echo "$MSG" | jq -r '.messageId')

$CLI --json read --email-id "$ID" --message-id "$MSG_ID"
```

## Commands

| Command | Required options | Notes |
|---------|------------------|-------|
| `config set` | `<key> <value>` | keys: `api-url`, `api-key` |
| `create` | - | `--name`, `--domain`, `--expiry` |
| `list` | - | `--email-id`, `--cursor` |
| `wait` | `--email-id` | `--timeout`, `--interval` |
| `read` | `--email-id`, `--message-id` | `--format text|html` |
| `send` | `--email-id`, `--to`, `--subject`, `--content` | - |
| `delete` | `--email-id` | - |

## Important details

- `--json` is a global flag and works before or after the subcommand.
- Call `create` once and parse both `id` and `address` from the same JSON result.
- Check both `content` and `html` when reading HTML-heavy messages.
