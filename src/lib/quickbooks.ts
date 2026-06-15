import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { deflateRawSync, inflateRawSync } from "zlib";

export type QuickBooksEnvironment = "sandbox" | "production";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
};

export type QuickBooksSession = {
  id: string;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  connectedAt: number;
};

export type CustomerSummary = {
  id: string;
  syncToken: string;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  balance: number | null;
  active: boolean | null;
  lastUpdatedTime: string;
};

type QuickBooksCustomer = {
  Id?: string;
  SyncToken?: string;
  DisplayName?: string;
  FullyQualifiedName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address?: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Balance?: number | string;
  Active?: boolean;
  MetaData?: {
    LastUpdatedTime?: string;
  };
};

type QuickBooksQueryResponse = {
  QueryResponse?: {
    Customer?: QuickBooksCustomer[];
  };
  Fault?: {
    Error?: Array<{
      Message?: string;
      Detail?: string;
      code?: string;
    }>;
  };
};

type QuickBooksCustomerResponse = {
  Customer?: QuickBooksCustomer;
  Fault?: QuickBooksQueryResponse["Fault"];
};

type QuickBooksCompanyInfoResponse = {
  CompanyInfo?: {
    CompanyName?: string;
    LegalName?: string;
  };
  Fault?: QuickBooksQueryResponse["Fault"];
};

export const QUICKBOOKS_SESSION_COOKIE = "quickbooks_session";
export const QUICKBOOKS_STATE_COOKIE = "quickbooks_oauth_state";
export const QUICKBOOKS_FORCE_PROMPT_COOKIE = "quickbooks_force_prompt";

const AUTHORIZATION_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_ENDPOINT =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOCATION_ENDPOINT =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";
const DEFAULT_REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 100;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export class QuickBooksConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuickBooksConfigError";
  }
}

export function getQuickBooksEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

export function getQuickBooksApiBaseUrl() {
  return getQuickBooksEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function getQuickBooksRedirectUri(origin: string) {
  return process.env.QUICKBOOKS_REDIRECT_URI ?? `${origin}/auth/quickbooks`;
}

export function buildQuickBooksAuthorizationUrl(
  origin: string,
  options: { forcePrompt?: boolean } = {},
) {
  const clientId = requireEnv("QUICKBOOKS_CLIENT_ID");
  const redirectUri = getQuickBooksRedirectUri(origin);
  const state = crypto.randomUUID();
  const authorizationUrl = new URL(AUTHORIZATION_ENDPOINT);

  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", ACCOUNTING_SCOPE);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);

  if (options.forcePrompt) {
    authorizationUrl.searchParams.set("prompt", "login select_account");
  }

  return {
    state,
    url: authorizationUrl,
  };
}

export async function exchangeAuthorizationCode(code: string, origin: string) {
  return postTokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: getQuickBooksRedirectUri(origin),
  });
}

export function createQuickBooksSession(
  realmId: string,
  tokenResponse: TokenResponse,
) {
  const now = Date.now();
  const session: QuickBooksSession = {
    id: crypto.randomUUID(),
    realmId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    accessTokenExpiresAt: now + tokenResponse.expires_in * 1000,
    refreshTokenExpiresAt:
      now +
      (tokenResponse.x_refresh_token_expires_in ??
        DEFAULT_REFRESH_TOKEN_SECONDS) *
        1000,
    connectedAt: now,
  };

  return session;
}

export function encodeQuickBooksSessionCookie(session: QuickBooksSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSessionEncryptionKey(), iv);
  const plaintext = deflateRawSync(
    Buffer.from(JSON.stringify(session), "utf8"),
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join(".");
}

export function getQuickBooksSession(cookieValue?: string) {
  if (!cookieValue) {
    return undefined;
  }

  const session = decodeQuickBooksSessionCookie(cookieValue);
  if (!session) {
    return undefined;
  }

  if (session.refreshTokenExpiresAt <= Date.now()) {
    return undefined;
  }

  return session;
}

export function getSessionCookieMaxAge(session: QuickBooksSession) {
  return Math.max(
    0,
    Math.floor((session.refreshTokenExpiresAt - Date.now()) / 1000),
  );
}

export function getSecureCookieSetting(origin: string) {
  return origin.startsWith("https://");
}

export async function fetchCustomerSummaries(session: QuickBooksSession) {
  await refreshSessionIfNeeded(session);

  const query =
    "SELECT * FROM Customer ORDERBY MetaData.LastUpdatedTime DESC STARTPOSITION 1 MAXRESULTS 20";
  const url = new URL(
    `/v3/company/${session.realmId}/query`,
    getQuickBooksApiBaseUrl(),
  );
  url.searchParams.set("query", query);
  url.searchParams.set(
    "minorversion",
    process.env.QUICKBOOKS_MINOR_VERSION ?? "75",
  );

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const body = await parseResponseBody<QuickBooksQueryResponse>(response);

  if (!response.ok) {
    throw new Error(formatQuickBooksError(body, response.status));
  }

  return (body.QueryResponse?.Customer ?? [])
    .map(toCustomerSummary)
    .sort(compareCustomerUpdatedTimeDescending);
}

export async function fetchCompanyName(session: QuickBooksSession) {
  await refreshSessionIfNeeded(session);

  const url = new URL(
    `/v3/company/${session.realmId}/companyinfo/${session.realmId}`,
    getQuickBooksApiBaseUrl(),
  );
  url.searchParams.set(
    "minorversion",
    process.env.QUICKBOOKS_MINOR_VERSION ?? "75",
  );

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const body = await parseResponseBody<QuickBooksCompanyInfoResponse>(response);

  if (!response.ok) {
    throw new Error(formatQuickBooksError(body, response.status));
  }

  return (
    body.CompanyInfo?.CompanyName ??
    body.CompanyInfo?.LegalName ??
    "QuickBooks company"
  );
}

export async function renameCustomer(
  session: QuickBooksSession,
  customerId: string,
  syncToken: string,
  displayName: string,
) {
  await refreshSessionIfNeeded(session);

  const url = new URL(
    `/v3/company/${session.realmId}/customer`,
    getQuickBooksApiBaseUrl(),
  );
  url.searchParams.set(
    "minorversion",
    process.env.QUICKBOOKS_MINOR_VERSION ?? "75",
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      DisplayName: displayName,
      Id: customerId,
      SyncToken: syncToken,
      sparse: true,
    }),
    cache: "no-store",
  });

  const body = await parseResponseBody<QuickBooksCustomerResponse>(response);

  if (!response.ok) {
    throw new Error(formatQuickBooksError(body, response.status));
  }

  return body.Customer ? toCustomerSummary(body.Customer) : undefined;
}

export async function revokeQuickBooksSession(session: QuickBooksSession) {
  const errors: Error[] = [];
  const tokens = Array.from(
    new Set([session.refreshToken, session.accessToken].filter(Boolean)),
  );

  for (const token of tokens) {
    try {
      await revokeQuickBooksToken(token, session.realmId);
      return;
    } catch (error) {
      errors.push(
        error instanceof Error ? error : new Error("QuickBooks revoke failed."),
      );
    }
  }

  throw errors[0] ?? new Error("QuickBooks revoke failed.");
}

async function revokeQuickBooksToken(token: string, realmId: string) {
  const clientId = requireEnv("QUICKBOOKS_CLIENT_ID");
  const clientSecret = requireEnv("QUICKBOOKS_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const url = new URL(REVOCATION_ENDPOINT);
  url.searchParams.set("realmId", realmId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseResponseBody<{ error?: string }>(response);
    throw new Error(
      body.error ??
        `QuickBooks revoke request failed with status ${response.status}.`,
    );
  }
}

export async function buildQuickBooksMcpPrompt(session: QuickBooksSession) {
  await refreshSessionIfNeeded(session);

  const clientId = requireEnv("QUICKBOOKS_CLIENT_ID");
  const clientSecret = requireEnv("QUICKBOOKS_CLIENT_SECRET");
  const environment = getQuickBooksEnvironment();

  return [
    "You are helping me install and register the QuickBooks Online MCP server on this computer.",
    "",
    "Important handling rules:",
    "- Treat every token and client secret in this prompt as sensitive.",
    "- Do not print, echo, summarize, or commit secret values.",
    "- Store secrets only in the MCP server's local .env file.",
    "- Do not put QuickBooks secrets into Claude, Codex, shell profile, git, or README files.",
    "- Use OS-appropriate commands for this computer. Support macOS, Linux, and Windows.",
    "",
    "Assumptions:",
    "- I have already cloned the QuickBooks Online MCP server repository.",
    "- If this chat is not already opened in that cloned repository, ask me for the absolute path to the clone before running install commands.",
    "- The MCP server entrypoint after build is dist/index.js.",
    "",
    "QuickBooks credentials from QuickAuth:",
    `Environment: ${environment}`,
    "",
    `Realm ID: ${session.realmId}`,
    `Client ID: ${clientId}`,
    `Client secret: ${clientSecret}`,
    `Access token: ${session.accessToken}`,
    `Access token expires at: ${new Date(session.accessTokenExpiresAt).toISOString()}`,
    `Refresh token: ${session.refreshToken}`,
    `Refresh token expires at: ${new Date(session.refreshTokenExpiresAt).toISOString()}`,
    "",
    "Tasks:",
    "1. Before asking me for any repository path, check whether the quickbooks MCP server is already registered, enabled, or otherwise available in the current MCP client context.",
    "   - Check the relevant MCP client list/get/config command or available tool registry when possible.",
    "   - If quickbooks is already available, do not ask me for the MCP server path and do not rerun setup. Simply tell me: You are ready to start working with QuickBooks.",
    "   - If quickbooks is not available, continue with the setup steps below.",
    "2. Find the cloned MCP server repository. Confirm it contains package.json and src/index.ts.",
    "3. Check that Node.js and npm are installed.",
    "   - Require Node.js 20 or newer.",
    "   - If Node.js or npm is missing, stop and tell me to install Node.js LTS, then rerun this prompt.",
    "4. Install and build the MCP server:",
    "   - Prefer npm ci when package-lock.json exists.",
    "   - Otherwise run npm install.",
    "   - Run npm run build.",
    "5. Create or update the repository-local .env file with:",
    "   - QUICKBOOKS_CLIENT_ID",
    "   - QUICKBOOKS_CLIENT_SECRET",
    "   - QUICKBOOKS_ENVIRONMENT",
    "   - QUICKBOOKS_REFRESH_TOKEN",
    "   - QUICKBOOKS_REALM_ID",
    "   - QUICKBOOKS_ACCESS_TOKEN",
    "   - QUICKBOOKS_ACCESS_TOKEN_EXPIRES_AT",
    "   - QUICKBOOKS_REDIRECT_URI=http://localhost:8000/callback unless another redirect URI is already present",
    "   Use the credential values above. Preserve unrelated existing .env values.",
    "6. Register the built MCP server globally/user-wide so future Claude Code or Codex chats can use it.",
    "   - For Claude Code, if the claude CLI is available, run:",
    '     claude mcp add -s user quickbooks -- node "<absolute-path-to-repo>/dist/index.js"',
    "   - For Codex, if the codex CLI is available, run:",
    '     codex mcp add quickbooks -- node "<absolute-path-to-repo>/dist/index.js"',
    "     If that command is unavailable, edit the user Codex config instead:",
    "       macOS/Linux: ~/.codex/config.toml",
    "       Windows: %USERPROFILE%\\.codex\\config.toml",
    "     Add or update:",
    "       [mcp_servers.quickbooks]",
    '       command = "node"',
    '       args = ["<absolute-path-to-repo>/dist/index.js"]',
    "       startup_timeout_sec = 20",
    "       tool_timeout_sec = 120",
    "     Use forward slashes in Windows TOML paths, for example C:/Users/name/path/dist/index.js.",
    "   - For Claude Desktop, only if I ask for it, add the same stdio server to:",
    "       macOS: ~/Library/Application Support/Claude/claude_desktop_config.json",
    "       Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
    "7. Verify:",
    "   - Confirm dist/index.js exists.",
    "   - If possible, run the MCP client's list/get command and confirm quickbooks is enabled or connected.",
    "   - Do not call QuickBooks accounting tools unless I explicitly ask.",
    "8. Tell me to start a new Claude Code or Codex chat after registration. Existing chats may not hot-load new MCP tools.",
    "",
    "Expected behavior after setup:",
    "- I should not need to paste these credentials again for every chat.",
    "- The MCP server stores the refresh token locally in .env.",
    "- The MCP server refreshes access tokens automatically.",
    "- If QuickBooks rotates the refresh token, the MCP server persists the rotated refresh token back to .env.",
    "- If the refresh token is expired or revoked, ask me to return to QuickAuth, sign in again, and copy a fresh setup prompt.",
  ].join("\n");
}

async function refreshSessionIfNeeded(session: QuickBooksSession) {
  if (session.accessTokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return;
  }

  const tokenResponse = await postTokenRequest({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });

  const now = Date.now();
  session.accessToken = tokenResponse.access_token;
  session.refreshToken = tokenResponse.refresh_token;
  session.accessTokenExpiresAt = now + tokenResponse.expires_in * 1000;
  session.refreshTokenExpiresAt =
    now +
    (tokenResponse.x_refresh_token_expires_in ??
      DEFAULT_REFRESH_TOKEN_SECONDS) *
      1000;
}

async function postTokenRequest(params: Record<string, string>) {
  const clientId = requireEnv("QUICKBOOKS_CLIENT_ID");
  const clientSecret = requireEnv("QUICKBOOKS_CLIENT_SECRET");
  const body = new URLSearchParams(params);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const tokenResponse = await parseResponseBody<
    TokenResponse & { error?: string; error_description?: string }
  >(response);

  if (!response.ok) {
    const message =
      tokenResponse.error_description ??
      tokenResponse.error ??
      `QuickBooks token request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
    throw new Error("QuickBooks did not return the expected OAuth tokens.");
  }

  return tokenResponse;
}

async function parseResponseBody<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { Fault: { Error: [{ Message: text }] } } as T;
  }
}

function formatQuickBooksError(body: QuickBooksQueryResponse, status: number) {
  const fault = body.Fault?.Error?.[0];
  return (
    fault?.Detail ??
    fault?.Message ??
    `QuickBooks API request failed with status ${status}.`
  );
}

function toCustomerSummary(customer: QuickBooksCustomer): CustomerSummary {
  const balance = Number(customer.Balance);

  return {
    id: customer.Id ?? "unknown",
    syncToken: customer.SyncToken ?? "",
    displayName:
      customer.DisplayName ?? customer.FullyQualifiedName ?? "Unnamed customer",
    companyName: customer.CompanyName ?? "",
    email: customer.PrimaryEmailAddr?.Address ?? "",
    phone: customer.PrimaryPhone?.FreeFormNumber ?? "",
    balance: Number.isFinite(balance) ? balance : null,
    active: typeof customer.Active === "boolean" ? customer.Active : null,
    lastUpdatedTime: customer.MetaData?.LastUpdatedTime ?? "",
  };
}

function compareCustomerUpdatedTimeDescending(
  first: CustomerSummary,
  second: CustomerSummary,
) {
  return (
    getSortableTime(second.lastUpdatedTime) -
    getSortableTime(first.lastUpdatedTime)
  );
}

function getSortableTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function decodeQuickBooksSessionCookie(cookieValue: string) {
  try {
    const [version, iv, authTag, ciphertext] = cookieValue.split(".");
    if (version !== "v1" || !iv || !authTag || !ciphertext) {
      return undefined;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSessionEncryptionKey(),
      fromBase64Url(iv),
    );
    decipher.setAuthTag(fromBase64Url(authTag));

    const compressed = Buffer.concat([
      decipher.update(fromBase64Url(ciphertext)),
      decipher.final(),
    ]);
    const parsed = JSON.parse(inflateRawSync(compressed).toString("utf8"));

    return isQuickBooksSession(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isQuickBooksSession(value: unknown): value is QuickBooksSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<QuickBooksSession>;
  return (
    typeof session.id === "string" &&
    typeof session.realmId === "string" &&
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.accessTokenExpiresAt === "number" &&
    typeof session.refreshTokenExpiresAt === "number" &&
    typeof session.connectedAt === "number"
  );
}

function getSessionEncryptionKey() {
  const secret =
    process.env.QUICKAUTH_SESSION_SECRET ??
    process.env.QUICKBOOKS_CLIENT_SECRET;

  if (!secret) {
    throw new QuickBooksConfigError(
      "Missing QUICKAUTH_SESSION_SECRET or QUICKBOOKS_CLIENT_SECRET.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new QuickBooksConfigError(`Missing ${name}.`);
  }

  return value;
}
