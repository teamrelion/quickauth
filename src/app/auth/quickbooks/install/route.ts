import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const url = new URL("/auth/quickbooks", request.url);
  url.searchParams.set("intent", "install");

  return NextResponse.redirect(url);
}
