/** Convert epoch ms timestamp to ISO 8601 string. */
export function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}
