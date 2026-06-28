import { cache } from "react";
import { getServerSession } from "@/lib/auth/session";

export type AuthPermission = string;

export type AuthContextUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: string;
  status: string;
  is_guest: boolean;
  avatar_path: string | null;
  timezone: string | null;
};

export type AuthContextAccess = {
  can_access_admin_dashboard: boolean;
  can_access_staff_dashboard: boolean;
  can_create_booking: boolean;
  can_view_booking_history: boolean;
  can_checkout: boolean;
  can_access_wallet: boolean;
  can_manage_users: boolean;
  can_hard_delete_users: boolean;
  requires_email_verification: boolean;
  requires_guest_conversion: boolean;
};

export type AuthContextData = {
  is_authenticated: true;
  is_guest: boolean;
  user: AuthContextUser;
  session: {
    id: string;
    type: string;
    expires_at: string | null;
  };
  permissions: readonly AuthPermission[];
  access: AuthContextAccess;
};

type AuthContextApiResponse = {
  data?: {
    context?: AuthContextData;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const getServerAuthContext = cache(
async function getServerAuthContext(): Promise<AuthContextData | null> {
  const session = await getServerSession();

  if (!session || !API_BASE_URL) {
    return null;
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/auth/context`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  );

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Auth context could not be loaded.");
  }

  const payload = (await response.json()) as AuthContextApiResponse;

  return payload.data?.context ?? null;
},
);
