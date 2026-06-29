import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QuickBooksConfigError,
  QuickBooksTokenRequestError,
  buildQuickBooksMcpPrompt,
  encodeQuickBooksSessionCookie,
  getSessionCookieOptions,
  getStoredQuickBooksSession,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const storedSession = getStoredQuickBooksSession(request.cookies);
  const session = storedSession?.session;

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
    const encodedSession = encodeQuickBooksSessionCookie(session);
    const sessionCookieOptions = getSessionCookieOptions(
      session,
      request.nextUrl.origin,
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
      response.cookies.delete(QUICKBOOKS_REMEMBERED_SESSION_COOKIE);
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
