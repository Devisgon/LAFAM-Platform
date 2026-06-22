"use client";
import { ROLE_PERMISSIONS } from "@/constants/permissions";
import type { AppRole } from "@/types/auth.types";
export function usePermission(role: AppRole | null | undefined, permission: string): boolean { return role ? ROLE_PERMISSIONS[role].includes(permission) : false; }

