"use client";

import { AdminCustomerManager } from "@/modules/customers";
import type { AdminUserRole } from "../api/usersApi";
import { UserListPanel } from "./user-management/UserListPanel";

export function AdminUserManager({
  roleFilter,
  showCreateCustomer = false,
  showViewAction = true,
}: {
  roleFilter?: AdminUserRole;
  showCreateCustomer?: boolean;
  showViewAction?: boolean;
}) {
  return (
    <div className="grid gap-6">
      {showCreateCustomer ? <AdminCustomerManager /> : null}
      <UserListPanel roleFilter={roleFilter} showViewAction={showViewAction} />
    </div>
  );
}
