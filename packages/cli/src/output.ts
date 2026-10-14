import { AuthError, ConfigError } from "@moemail/core";

/**
 * Print JSON to stdout (for --json mode).
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

/**
 * Print human-readable text to stdout.
 */
export function printText(text: string): void {
  console.log(text);
}

/**
 * Log to stderr (progress, errors — never pollutes stdout).
 */
export function log(message: string): void {
  console.error(message);
}

/**
 * Print an error to stderr and exit. Config/auth problems exit 2 (preserving
 * the previous behaviour); everything else exits 1.
 */
export function fail(e: unknown): never {
  const message = e instanceof Error ? e.message : String(e);
  log(`Error: ${message}`);
  process.exit(e instanceof ConfigError || e instanceof AuthError ? 2 : 1);
}
