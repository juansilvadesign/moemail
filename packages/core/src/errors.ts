/**
 * Error classes shared by CLI and MCP frontends.
 *
 * The core HTTP client throws these instead of writing to stderr / exiting,
 * so each frontend can decide how to surface them (CLI: print + exit,
 * MCP: structured isError result).
 */

/** Configuration is missing (apiUrl or apiKey not set). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Generic non-2xx API response. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 401 — API key invalid / authentication failed. */
export class AuthError extends ApiError {
  constructor(message = "Authentication failed. Check your API Key.") {
    super(401, message);
    this.name = "AuthError";
  }
}

/**
 * 403 — request rejected for permission reasons. On a MoeMail Pro server this
 * covers: no OpenAPI permission, domain requires a higher role, or permanent
 * mailbox requires Duke. The server message is passed through verbatim.
 */
export class PermissionError extends ApiError {
  constructor(message: string) {
    super(403, message);
    this.name = "PermissionError";
  }
}

/**
 * 429 — monthly OpenAPI call quota exceeded (MoeMail Pro). Carries the quota
 * figures from the response body when present.
 */
export class QuotaError extends ApiError {
  constructor(
    message: string,
    public monthlyLimit?: number,
    public monthlyUsed?: number,
  ) {
    super(429, message);
    this.name = "QuotaError";
  }
}
