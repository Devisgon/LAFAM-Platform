import { type NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "lafam_access_token";
const REFRESH_TOKEN_COOKIE = "lafam_refresh_token";
const ROLE_COOKIE = "lafam_role";

const protectedRoutes = [
  "/admin",
  "/staff",
  "/user",
  "/customer",
  "/guest",
  "/profile",
  "/account",
];

function getDashboardPath(role?: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "/admin";
    case "staff":
    case "trainer":
      return "/staff";
    case "customer":
    case "user":
      return "/user";
    case "guest":
      return "/guest";
    default:
      return "/admin";
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const hasPossibleSession = Boolean(accessToken || refreshToken);

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = pathname === "/" || pathname.startsWith("/signup");

  if (isProtectedRoute && !hasPossibleSession) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasPossibleSession) {
    return NextResponse.redirect(new URL(getDashboardPath(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/signup/:path*",
    "/admin/:path*",
    "/staff/:path*",
    "/user/:path*",
    "/customer/:path*",
    "/guest/:path*",
    "/profile/:path*",
    "/account/:path*",
  ],
};
