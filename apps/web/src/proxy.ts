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

type VerifiedProxySession = {
  role: string;
  refreshedSession: ProxyRefreshSession | null;
};

const protectedRoutes = [
  "/dashboard",
  "/bookings",
  "/calendar",
  "/payments",
  "/services/pilates",
  "/settings",
  "/staff",
  "/users",
  "/wallet",
];
const adminOnlyRoutes = ["/calendar", "/payments", "/staff", "/users"];
const authRoutes = ["/login", "/signup", "/forgot-password", "/verify-email"];

const authCookieNames = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ROLE_COOKIE,
  SESSION_ID_COOKIE,
] as const;

function isRouteMatch(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAdminRole(role?: string): boolean {
  return Boolean(role && adminRoles.has(role));
}

function getDashboardPath(role?: string): string {
  if (isAdminRole(role)) return "/dashboard";

  if (role) return "/dashboard";

  return "/";
}

function canAccessPath(pathname: string, role?: string): boolean {
  if (!role) return false;
  return !adminOnlyRoutes.some((route) => isRouteMatch(pathname, route)) ||
    isAdminRole(role);
}

function getApiUrl(path: string): string | null {
  if (!API_BASE_URL) return null;

  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
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

function setRoleCookie(
  response: NextResponse,
  request: NextRequest,
  role: string,
): void {
  response.cookies.set(ROLE_COOKIE, role, {
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
}

function clearSessionCookies(
  response: NextResponse,
  request: NextRequest,
): void {
  const secure = request.nextUrl.protocol === "https:";

  for (const cookieName of authCookieNames) {
    response.cookies.set(cookieName, "", {
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure,
    });
  }
}

function redirectToLoginWithClearedSession(
  request: NextRequest,
  pathname: string,
): NextResponse {
  const loginUrl = new URL("/login", request.url);

  if (pathname !== "/login") {
    loginUrl.searchParams.set("redirect", pathname);
  }

  const response = NextResponse.redirect(loginUrl);
  clearSessionCookies(response, request);

  return response;
}

function rewriteUnauthorized(request: NextRequest): NextResponse {
  const unauthorizedUrl = new URL("/unauthorized", request.url);

  return NextResponse.redirect(unauthorizedUrl);
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

async function resolveValidSession(
  accessToken?: string,
  refreshToken?: string,
): Promise<VerifiedProxySession | null> {
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
    return null;
  }

  return {
    role: verifiedRole,
    refreshedSession,
  };
}

function applySessionCookieUpdates(
  response: NextResponse,
  request: NextRequest,
  session: VerifiedProxySession,
  currentRole?: string,
): void {
  if (session.refreshedSession) {
    setSessionCookies(
      response,
      request,
      session.refreshedSession,
      session.role,
    );
    return;
  }

  if (session.role !== currentRole) {
    setRoleCookie(response, request, session.role);
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
  const isAuthRoute = authRoutes.some((route) => isRouteMatch(pathname, route));

  if (isProtectedRoute && !hasPossibleSession) {
    return redirectToLoginWithClearedSession(request, pathname);
  }

  if (isProtectedRoute) {
    const session = await resolveValidSession(accessToken, refreshToken);

    if (!session) {
      return redirectToLoginWithClearedSession(request, pathname);
    }

    if (!canAccessPath(pathname, session.role)) {
      return rewriteUnauthorized(request);
    }

    const response = NextResponse.next();
    applySessionCookieUpdates(response, request, session, role);

    return response;
  }

  if (isAuthRoute && hasPossibleSession) {
    const session = await resolveValidSession(accessToken, refreshToken);

    if (!session) {
      const response = NextResponse.next();
      clearSessionCookies(response, request);

      return response;
    }

    const dashboardPath = getDashboardPath(session.role);

    if (dashboardPath !== pathname) {
      const response = NextResponse.redirect(
        new URL(dashboardPath, request.url),
      );
      applySessionCookieUpdates(response, request, session, role);

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup/:path*",
    "/forgot-password/:path*",
    "/verify-email/:path*",
    "/dashboard/:path*",
    "/bookings/:path*",
    "/calendar/:path*",
    "/payments/:path*",
    "/services/pilates/:path*",
    "/settings/:path*",
    "/staff/:path*",
    "/users/:path*",
    "/wallet/:path*",
  ],
};
