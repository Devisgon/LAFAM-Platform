import { type NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "lafam_access_token";
const REFRESH_TOKEN_COOKIE = "lafam_refresh_token";
const ROLE_COOKIE = "lafam_role";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const adminRoles = new Set(["admin", "super_admin"]);

const protectedRoutes = [
  "/admin",
  "/staff",
  "/user",
  "/customer",
  "/guest",
  "/profile",
  "/account",
];

function isRouteMatch(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAdminRole(role?: string): boolean {
  return Boolean(role && adminRoles.has(role));
}

function getDashboardPath(role?: string): string {
  if (isAdminRole(role)) return "/admin";

  if (role) return "/user";

  return "/";
}

function canAccessPath(pathname: string, role?: string): boolean {
  if (!role) return false;

  if (isRouteMatch(pathname, "/admin")) {
    return isAdminRole(role);
  }

  if (isRouteMatch(pathname, "/user")) {
    return !isAdminRole(role);
  }

  return false;
}

function rewriteUnauthorized(request: NextRequest): NextResponse {
  const unauthorizedUrl = new URL("/unauthorized", request.url);

  return NextResponse.rewrite(unauthorizedUrl, { status: 404 });
}

function getApiUrl(path: string): string | null {
  if (!API_BASE_URL) return null;

  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

function extractRole(payload: unknown): string | null {
  const data = (payload as { data?: unknown } | null)?.data;

  if (!data || typeof data !== "object") return null;

  const user = (data as { user?: unknown }).user;

  if (user && typeof user === "object") {
    const role = (user as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  }

  const role = (data as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
}

async function getVerifiedRole(accessToken?: string): Promise<string | null> {
  const authMeUrl = getApiUrl("/auth/me");

  if (!accessToken || !authMeUrl) return null;

  try {
    const response = await fetch(authMeUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    return extractRole(await response.json());
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const hasPossibleSession = Boolean(accessToken || refreshToken);

  const isProtectedRoute = protectedRoutes.some((route) =>
    isRouteMatch(pathname, route),
  );
  const isAuthRoute = pathname === "/" || pathname.startsWith("/signup");

  if (isProtectedRoute && !hasPossibleSession) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedRoute) {
    const verifiedRole = await getVerifiedRole(accessToken);

    if (!verifiedRole) {
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!canAccessPath(pathname, verifiedRole)) {
      return rewriteUnauthorized(request);
    }

    if (verifiedRole !== role) {
      const response = NextResponse.next();
      response.cookies.set(ROLE_COOKIE, verifiedRole, {
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
      return response;
    }
  }

  if (isAuthRoute && hasPossibleSession) {
    const verifiedRole = accessToken ? await getVerifiedRole(accessToken) : null;
    const dashboardPath = getDashboardPath(verifiedRole ?? role);

    if (dashboardPath !== pathname) {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
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
