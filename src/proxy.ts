import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeSession } from "@/lib/auth/session-token";

const SESSION_COOKIE = "aj_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = decodeSession(
    request.cookies.get(SESSION_COOKIE)?.value,
    Date.now(),
  );
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    const loginUrl = new URL("/login", request.url);
    const next = `${pathname}${search}`;
    if (next && next !== "/") {
      loginUrl.searchParams.set("next", next);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Do not skip paths just because they end with image-like extensions —
  // those can be valid org codes / app routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
