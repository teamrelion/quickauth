import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  getSessionCookieOptions,
  getStoredQuickBooksSession,
} from "@/lib/quickbooks";

export async function GET(request: NextRequest) {
  const storedSession = getStoredQuickBooksSession(request.cookies);
  const url = new URL("/", request.url);
  url.searchParams.set("notice", "signed_out");

  const response = NextResponse.redirect(url);

  if (storedSession) {
    response.cookies.set(
      QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
      storedSession.cookieValue,
      getSessionCookieOptions(storedSession.session, request.nextUrl.origin),
    );
  }

  response.cookies.delete(QUICKBOOKS_SESSION_COOKIE);
  response.cookies.delete(QUICKBOOKS_STATE_COOKIE);

  return response;
}
