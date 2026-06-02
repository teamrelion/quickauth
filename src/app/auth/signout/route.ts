import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_SESSION_COOKIE,
  QUICKBOOKS_STATE_COOKIE,
  deleteQuickBooksSession,
} from "@/lib/quickbooks";

export async function GET(request: NextRequest) {
  deleteQuickBooksSession(
    request.cookies.get(QUICKBOOKS_SESSION_COOKIE)?.value,
  );

  const url = new URL("/", request.url);
  url.searchParams.set("notice", "signed_out");

  const response = NextResponse.redirect(url);
  response.cookies.delete(QUICKBOOKS_SESSION_COOKIE);
  response.cookies.delete(QUICKBOOKS_STATE_COOKIE);

  return response;
}
