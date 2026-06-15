import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_FORCE_PROMPT_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  QuickBooksConfigError,
  buildQuickBooksAuthorizationUrl,
  createQuickBooksSession,
  encodeQuickBooksSessionCookie,
  exchangeAuthorizationCode,
  getSecureCookieSetting,
  getSessionCookieMaxAge,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error")) {
    return redirectHomeWithStatus(request, "quickbooks_access_denied");
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return startQuickBooksAuthorization(request);
  }

  return completeQuickBooksAuthorization(request, code);
}

function startQuickBooksAuthorization(request: NextRequest) {
  try {
    const forcePrompt =
      request.cookies.get(QUICKBOOKS_FORCE_PROMPT_COOKIE)?.value === "1";
    const { state, url } = buildQuickBooksAuthorizationUrl(
      request.nextUrl.origin,
      { forcePrompt },
    );
    const response = NextResponse.redirect(url);

    response.cookies.set(QUICKBOOKS_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: getSecureCookieSetting(request.nextUrl.origin),
    });
    response.cookies.delete(QUICKBOOKS_FORCE_PROMPT_COOKIE);

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
    const session = createQuickBooksSession(realmId, tokenResponse);
    const response = redirectHomeWithStatus(request, "connected");

    response.cookies.set(
      QUICKBOOKS_SESSION_COOKIE,
      encodeQuickBooksSessionCookie(session),
      {
        httpOnly: true,
        maxAge: getSessionCookieMaxAge(session),
        path: "/",
        sameSite: "lax",
        secure: getSecureCookieSetting(request.nextUrl.origin),
      },
    );
    response.cookies.delete(QUICKBOOKS_STATE_COOKIE);

    return response;
  } catch {
    return redirectHomeWithStatus(request, "quickbooks_token");
  }
}

function redirectHomeWithStatus(request: NextRequest, status: string) {
  const url = new URL("/", request.url);

  if (status === "connected") {
    url.searchParams.set("notice", status);
  } else {
    url.searchParams.set("error", status);
  }

  return NextResponse.redirect(url);
}
