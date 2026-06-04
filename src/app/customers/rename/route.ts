import { NextRequest, NextResponse } from "next/server";
import {
  QUICKBOOKS_SESSION_COOKIE,
  encodeQuickBooksSessionCookie,
  getSecureCookieSetting,
  getSessionCookieMaxAge,
  getQuickBooksSession,
  renameCustomer,
} from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getQuickBooksSession(
    request.cookies.get(QUICKBOOKS_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return redirectHomeWithStatus(request, "rename_auth");
  }

  const formData = await request.formData();
  const customerId = getFormValue(formData, "customerId");
  const syncToken = getFormValue(formData, "syncToken");
  const displayName = getFormValue(formData, "displayName").trim();

  if (!customerId || !syncToken || !displayName) {
    return redirectHomeWithStatus(request, "rename_invalid");
  }

  try {
    await renameCustomer(session, customerId, syncToken, displayName);
    const response = redirectHomeWithStatus(request, "renamed");
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
    return redirectHomeWithStatus(request, "rename_failed");
  }
}

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function redirectHomeWithStatus(request: NextRequest, status: string) {
  const url = new URL("/", request.url);

  if (status === "renamed") {
    url.searchParams.set("notice", status);
  } else {
    url.searchParams.set("error", status);
  }

  return NextResponse.redirect(url, 303);
}
