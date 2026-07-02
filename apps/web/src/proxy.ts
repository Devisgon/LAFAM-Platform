import { type NextRequest, NextResponse } from "next/server";

import {
  LEGACY_AUTH_SESSION_MAX_AGE_SECONDS,
  resolveSessionCookieMaxAgeSeconds,
} from "@/lib/auth/session-cookie";
import {
  ADMIN_ROUTE_ACCESS,
  isAdminRole as isSharedAdminRole,
} from "@/constants/permissions";

const ACCESS_TOKEN_COOKIE = "lafam_access_token";
const REFRESH_TOKEN_COOKIE = "lafam_refresh_token";
const ROLE_COOKIE = "lafam_role";
const SESSION_ID_COOKIE = "lafam_session_id";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const staffDashboardRoles = new Set(["staff", "trainer", "stylist"]);

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
    expires_at?: string | null;
  } | null;
};

type ProxyAuthContext = {
  access?: {
    can_access_admin_dashboard?: boolean;
    can_access_staff_dashboard?: boolean;
  };
  permissions?: readonly string[];
  user?: {
    role?: string | null;
  } | null;
};

type ProxyAuthContextApiResponse = {
  data?: {
    context?: ProxyAuthContext;
  };
};

type ProxyRefreshSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: string | null;
  sessionId: string | null;
  sessionCookieMaxAgeSeconds: number;
};

type VerifiedProxySession = {
  context: ProxyAuthContext;
  role: string;
  refreshedSession: ProxyRefreshSession | null;
};

const protectedRoutes = [
  "/dashboard",
  "/bookings",
  "/calendar",
  "/payments",
  "/promos",
  "/services/pilates",
  "/settings",
  "/staff",
  "/users",
  "/wallet",
];
const authRoutes = ["/login", "/forgot-password"];

const authCookieNames = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ROLE_COOKIE,
  SESSION_ID_COOKIE,
] as const;

function isRouteMatch(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function getDashboardPath(role?: string): string {
  if (isSharedAdminRole(role)) return "/dashboard";

  if (role && staffDashboardRoles.has(role)) return "/bookings";

  if (role) return "/dashboard";

  return "/";
}

const routePermissionMap = Object.entries(ADMIN_ROUTE_ACCESS)
  .map(([route, access]) => ({ route, permissions: access.anyPermissions }))
  .sort((left, right) => right.route.length - left.route.length);

function canAccessPath(pathname: string, context: ProxyAuthContext): boolean {
  if (context.access?.can_access_admin_dashboard) return true;
  if (!context.access?.can_access_staff_dashboard) return false;

  const routeAccess = routePermissionMap.find(({ route }) =>
    isRouteMatch(pathname, route),
  );

  if (!routeAccess) return false;

  const permissions = new Set(context.permissions ?? []);

  return routeAccess.permissions.some((permission) =>
    permissions.has(permission),
  );
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

  const sessionCookieMaxAgeSeconds = resolveSessionCookieMaxAgeSeconds(
    data.session?.expires_at,
  );

  if (!sessionCookieMaxAgeSeconds) {
    return null;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    role: data.user?.role ?? null,
    sessionId: data.session?.id ?? null,
    sessionCookieMaxAgeSeconds,
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
    maxAge: session.sessionCookieMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure,
  });

  response.cookies.set(ROLE_COOKIE, role, {
    maxAge: session.sessionCookieMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure,
  });

  if (session.sessionId) {
    response.cookies.set(SESSION_ID_COOKIE, session.sessionId, {
      maxAge: session.sessionCookieMaxAgeSeconds,
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
    // This path has no refresh response, so it uses the temporary legacy window.
    maxAge: LEGACY_AUTH_SESSION_MAX_AGE_SECONDS,
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

function extractAuthContext(payload: unknown): ProxyAuthContext | null {
  const context = (payload as ProxyAuthContextApiResponse | null)?.data
    ?.context;

  if (!context?.user?.role) return null;

  return context;
}

async function getVerifiedContext(
  accessToken?: string,
): Promise<ProxyAuthContext | null> {
  const authContextUrl = getApiUrl("/auth/context");

  if (!accessToken || !authContextUrl) return null;

  try {
    const response = await fetch(authContextUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    return extractAuthContext(await response.json());
  } catch {
    return null;
  }
}

async function resolveValidSession(
  accessToken?: string,
  refreshToken?: string,
): Promise<VerifiedProxySession | null> {
  let verifiedContext = await getVerifiedContext(accessToken);
  let refreshedSession: ProxyRefreshSession | null = null;

  if (!verifiedContext && refreshToken) {
    refreshedSession = await refreshSessionInProxy(refreshToken);

    if (refreshedSession) {
      verifiedContext = await getVerifiedContext(refreshedSession.accessToken);
    }
  }

  if (!verifiedContext?.user?.role) {
    return null;
  }

  return {
    context: verifiedContext,
    role: verifiedContext.user.role,
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

    if (!canAccessPath(pathname, session.context)) {
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
    "/forgot-password/:path*",
    "/dashboard/:path*",
    "/bookings/:path*",
    "/calendar/:path*",
    "/payments/:path*",
    "/promos/:path*",
    "/services/pilates/:path*",
    "/settings/:path*",
    "/staff/:path*",
    "/users/:path*",
    "/wallet/:path*",
  ],
};
