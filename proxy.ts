import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Convenience only: sends visitors without a session cookie straight to the login page.
 * This is NOT the security check. Every admin page and action re-verifies the session,
 * role and MFA on the server (server/auth/index.ts → requireStaff).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone(); // keeps the incoming protocol and host
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
