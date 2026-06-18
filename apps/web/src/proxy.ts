import { type NextRequest, NextResponse } from "next/server";
const ACCESS_TOKEN_COOKIE = "lafam_access_token";
const REFRESH_TOKEN_COOKIE = "lafam_refresh_token";
const ROLE_COOKIE = "lafam_role";
const SESSION_ID_COOKIE = "lafam_session_id";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const adminRoles = new Set(["admin", "super_admin"]);

type ProxyRefreshApiData = {
  authenticated?: boolean;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number | null;
  user?: {
    role?: string | null;
  } | null;
  session?: {
    id?: string | null;
  } | null;
};

type ProxyRefreshSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: string | null;
  sessionId: string | null;
};

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

function extractRefreshSession(payload: unknown): ProxyRefreshSession | null {
  const data = (payload as { data?: ProxyRefreshApiData } | null)?.data;

  if (!data?.access_token || !data.refresh_token) {
    return null;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    role: data.user?.role ?? null,
    sessionId: data.session?.id ?? null,
  };
}

async function refreshSessionInProxy(
  refreshToken?: string,
): Promise<ProxyRefreshSession | null> {
  const refreshUrl = getApiUrl("/auth/refresh-token");

  if (!refreshToken || !refreshUrl) return null;

  try {
    const response = await fetch(refreshUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;

    return extractRefreshSession(await response.json());
  } catch {
    return null;
  }
}

function setSessionCookies(
  response: NextResponse,
  request: NextRequest,
  session: ProxyRefreshSession,
  role: string,
): void {
  const secure = request.nextUrl.protocol === "https:";

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    maxAge: session.expiresIn,
    path: "/",
    sameSite: "lax",
    secure,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure,
  });

  response.cookies.set(ROLE_COOKIE, role, {
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure,
  });

  if (session.sessionId) {
    response.cookies.set(SESSION_ID_COOKIE, session.sessionId, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure,
    });
  }
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
  let verifiedRole = await getVerifiedRole(accessToken);
  let refreshedSession: ProxyRefreshSession | null = null;

  if (!verifiedRole && refreshToken) {
    refreshedSession = await refreshSessionInProxy(refreshToken);

    if (refreshedSession) {
      verifiedRole =
        refreshedSession.role ??
        (await getVerifiedRole(refreshedSession.accessToken));
    }
  }

  if (!verifiedRole) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(pathname, verifiedRole)) {
    return rewriteUnauthorized(request);
  }

  const response = NextResponse.next();

  if (refreshedSession) {
    setSessionCookies(response, request, refreshedSession, verifiedRole);
    return response;
  }

  if (verifiedRole !== role) {
    response.cookies.set(ROLE_COOKIE, verifiedRole, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  return response;
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
