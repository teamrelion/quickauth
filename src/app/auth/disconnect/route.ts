import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_REMEMBERED_SESSION_COOKIE,
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  getStoredQuickBooksSession,
  revokeQuickBooksSession,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getStoredQuickBooksSession(request.cookies)?.session;

  if (session) {
    await revokeQuickBooksSession(session).catch(() => undefined);
  }

  const url = new URL("/", request.url);
  url.searchParams.set("notice", "disconnected");

  const response = NextResponse.redirect(url);
  response.cookies.delete(QUICKBOOKS_SESSION_COOKIE);
  response.cookies.delete(QUICKBOOKS_REMEMBERED_SESSION_COOKIE);
  response.cookies.delete(QUICKBOOKS_STATE_COOKIE);
  response.cookies.delete("quickbooks_force_prompt");

  return response;
}
