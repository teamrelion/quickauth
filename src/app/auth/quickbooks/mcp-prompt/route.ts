import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_FORCE_PROMPT_COOKIE,
  QuickBooksConfigError,
  QuickBooksTokenRequestError,
  buildQuickBooksMcpPrompt,
  encodeQuickBooksSessionCookie,
  getSecureCookieSetting,
  getSessionCookieMaxAge,
  getQuickBooksSession,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getQuickBooksSession(
    request.cookies.get(QUICKBOOKS_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return NextResponse.json(
      { error: "Sign in with QuickBooks before copying tokens." },
      { status: 401 },
    );
  }

  try {
    const response = NextResponse.json(
      { prompt: await buildQuickBooksMcpPrompt(session) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

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

    return response;
  } catch (error) {
    const sessionExpired =
      error instanceof QuickBooksTokenRequestError &&
      error.code === "invalid_grant";
    const response = NextResponse.json(
      {
        error: sessionExpired
          ? "Your QuickBooks authorization expired. Sign in again, then copy a fresh setup prompt."
          : getSetupPromptError(error),
      },
      { status: sessionExpired ? 401 : 500 },
    );

    if (sessionExpired) {
      response.cookies.delete(QUICKBOOKS_SESSION_COOKIE);
      response.cookies.set(QUICKBOOKS_FORCE_PROMPT_COOKIE, "1", {
        httpOnly: true,
        maxAge: 60 * 60 * 24,
        path: "/",
        sameSite: "lax",
        secure: getSecureCookieSetting(request.nextUrl.origin),
      });
    }

    return response;
  }
}

function getSetupPromptError(error: unknown) {
  if (error instanceof QuickBooksConfigError) {
    return "QuickBooks credentials are not configured for this app.";
  }

  if (error instanceof QuickBooksTokenRequestError) {
    return "QuickBooks could not refresh the authorization. Please try again.";
  }

  return "Unable to prepare the setup prompt for copying.";
}
