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

type SessionStore = Map<string, QuickBooksSession>;

const globalForSessions = globalThis as typeof globalThis & {
  __quickbooksSessions?: SessionStore;
};

const sessions =
  globalForSessions.__quickbooksSessions ??
  (globalForSessions.__quickbooksSessions = new Map());

export const QUICKBOOKS_SESSION_COOKIE = "quickbooks_session";
export const QUICKBOOKS_STATE_COOKIE = "quickbooks_oauth_state";

const AUTHORIZATION_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_ENDPOINT =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
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

export function buildQuickBooksAuthorizationUrl(origin: string) {
  const clientId = requireEnv("QUICKBOOKS_CLIENT_ID");
  const redirectUri = getQuickBooksRedirectUri(origin);
  const state = crypto.randomUUID();
  const authorizationUrl = new URL(AUTHORIZATION_ENDPOINT);

  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", ACCOUNTING_SCOPE);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);

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

  sessions.set(session.id, session);
  return session;
}

export function getQuickBooksSession(sessionId?: string) {
  if (!sessionId) {
    return undefined;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return undefined;
  }

  if (session.refreshTokenExpiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
}

export function deleteQuickBooksSession(sessionId?: string) {
  if (sessionId) {
    sessions.delete(sessionId);
  }
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

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new QuickBooksConfigError(`Missing ${name}.`);
  }

  return value;
}
