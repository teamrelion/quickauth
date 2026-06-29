import { NextRequest, NextResponse } from "next/server";
import type { QuickBooksAuthorizationIntent } from "@/lib/quickbooks";
import {
  QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  QuickBooksConfigError,
  buildQuickBooksAuthorizationUrl,
  createQuickBooksSession,
  encodeQuickBooksSessionCookie,
  exchangeAuthorizationCode,
  getSessionCookieOptions,
  getStoredQuickBooksSession,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error")) {
    const response = redirectHomeWithStatus(
      request,
      "quickbooks_access_denied",
    );
    response.cookies.delete(QUICKBOOKS_STATE_COOKIE);

    return response;
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return startQuickBooksAuthorization(request, getRequestedIntent(request));
  }

  return completeQuickBooksAuthorization(request, code);
}

function startQuickBooksAuthorization(
  request: NextRequest,
  intent: QuickBooksAuthorizationIntent,
) {
  const storedSession = getStoredQuickBooksSession(request.cookies);

  if (intent === "connect" && storedSession?.source === "active") {
    return redirectHomeWithStatus(request, "connected");
  }

  if (intent === "connect" && storedSession?.source === "remembered") {
    const response = redirectHomeWithStatus(request, "connected");
    response.cookies.set(
      QUICKBOOKS_SESSION_COOKIE,
      storedSession.cookieValue,
      getSessionCookieOptions(storedSession.session, request.nextUrl.origin),
    );

    return response;
  }

  try {
    const { state, url } = buildQuickBooksAuthorizationUrl(
      request.nextUrl.origin,
      {
        forcePrompt: intent === "install",
        intent,
      },
    );
    const response = NextResponse.redirect(url);

    response.cookies.set(QUICKBOOKS_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });

    return response;
  } catch (error) {
    return redirectHomeWithStatus(
      request,
      error instanceof QuickBooksConfigError
        ? "quickbooks_config"
        : "quickbooks_start_failed",
    );
  }
}

async function completeQuickBooksAuthorization(
  request: NextRequest,
  code: string,
) {
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(QUICKBOOKS_STATE_COOKIE)?.value;

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return redirectHomeWithStatus(request, "quickbooks_state");
  }

  const realmId = request.nextUrl.searchParams.get("realmId");
  if (!realmId) {
    return redirectHomeWithStatus(request, "quickbooks_realm");
  }

  try {
    const tokenResponse = await exchangeAuthorizationCode(
      code,
      request.nextUrl.origin,
    );
    const intent = getAuthorizationIntent(returnedState);
    const session = createQuickBooksSession(realmId, tokenResponse);
    const encodedSession = encodeQuickBooksSessionCookie(session);
    const sessionCookieOptions = getSessionCookieOptions(
      session,
      request.nextUrl.origin,
    );
    const response = redirectHomeWithStatus(
      request,
      intent === "install" ? "installed" : "connected",
    );

    response.cookies.set(
      QUICKBOOKS_SESSION_COOKIE,
      encodedSession,
      sessionCookieOptions,
    );
    response.cookies.set(
      QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
      encodedSession,
      sessionCookieOptions,
    );
    response.cookies.delete(QUICKBOOKS_STATE_COOKIE);

    return response;
  } catch {
    return redirectHomeWithStatus(request, "quickbooks_token");
  }
}

function redirectHomeWithStatus(request: NextRequest, status: string) {
  const url = new URL("/", request.url);

  if (["connected", "installed"].includes(status)) {
    url.searchParams.set("notice", status);
  } else {
    url.searchParams.set("error", status);
  }

  return NextResponse.redirect(url);
}

function getRequestedIntent(
  request: NextRequest,
): QuickBooksAuthorizationIntent {
  const intent = request.nextUrl.searchParams.get("intent");

  if (
    intent === "install" ||
    request.nextUrl.searchParams.get("install") === "1"
  ) {
    return "install";
  }

  return "connect";
}

function getAuthorizationIntent(
  state: string,
): QuickBooksAuthorizationIntent {
  return state.startsWith("install.") ? "install" : "connect";
}
