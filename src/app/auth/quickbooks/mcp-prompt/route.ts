import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_SESSION_COOKIE,
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
  } catch {
    return NextResponse.json(
      { error: "Unable to prepare the setup prompt for copying." },
      { status: 500 },
    );
  }
}
