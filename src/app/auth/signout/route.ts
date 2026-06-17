import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_FORCE_PROMPT_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  getSecureCookieSetting,
  getQuickBooksSession,
  revokeQuickBooksSession,
} from "@/lib/quickbooks";

const FORCE_PROMPT_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const session = getQuickBooksSession(
    request.cookies.get(QUICKBOOKS_SESSION_COOKIE)?.value,
  );

  if (!session) {
    const url = new URL("/", request.url);
    url.searchParams.set("notice", "signed_out");
    const response = NextResponse.redirect(url);
    clearQuickAuthCookies(response, request);

    return response;
  }

  await revokeQuickBooksSession(session).catch(() => undefined);

  const response = NextResponse.redirect(
    new URL("/auth/signout/complete", request.url),
  );
  clearQuickAuthCookies(response, request);

  return response;
}

function clearQuickAuthCookies(response: NextResponse, request: NextRequest) {
  response.cookies.delete(QUICKBOOKS_SESSION_COOKIE);
  response.cookies.delete(QUICKBOOKS_STATE_COOKIE);
  response.cookies.set(QUICKBOOKS_FORCE_PROMPT_COOKIE, "1", {
    httpOnly: true,
    maxAge: FORCE_PROMPT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: getSecureCookieSetting(request.nextUrl.origin),
  });
}
