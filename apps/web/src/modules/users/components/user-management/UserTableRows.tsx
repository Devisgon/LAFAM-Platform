"use client";

import { Badge } from "@/components/ui/Badge";

import type { AdminUser } from "../../api/usersApi";
import { isActiveUser, label, usernameFromUser } from "../../utils/userFormatters";
import { ActionButton, ViewCustomerLink } from "./UserControls";

export function UserRow({
  onAction,
  user,
}: {
  onAction: (action: "deactivate" | "reactivate" | "delete", user: AdminUser) => void;
  user: AdminUser;
}) {
  const customerDetailHref = user.customer_profile_id
    ? `/settings/customers/${encodeURIComponent(user.customer_profile_id)}`
    : null;

  return (
    <tr
      className="bg-card-bg-primary hover:bg-card-bg-secondary/40 odd:bg-background-secondary/20 transition divide-x divide-background-secondary"
      key={user.id}
    >
      <td className="px-4 py-4 alignment-fix">
        <div className="flex items-center justify-center gap-3">
          <input
            aria-label={`${user.full_name ?? user.email ?? "User"} active status`}
            checked={isActiveUser(user)}
            className="size-5 rounded border-background-secondary accent-primary cursor-default"
            readOnly
            type="checkbox"
          />
          <Badge tone="neutral">{label(user.status)}</Badge>
        </div>
      </td>
      <td className="px-4 py-4 font-medium text-txt-primary">
        {user.full_name ?? "Unnamed user"}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {user.phone ?? "Not provided"}
      </td>
      <td className="px-4 py-4 text-txt-primary break-all">
        {user.email ?? "No email"}
      </td>
      <td className="px-4 py-4 text-txt-primary">{usernameFromUser(user)}</td>
      <td className="px-4 py-4 text-center text-txt-secondary text-sm font-mono tracking-wider">
        â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢
      </td>
      <td className="px-4 py-4 text-txt-primary">
        <span className="block font-medium capitalize">{label(user.role)}</span>
        <span className="mt-0.5 block text-xs text-txt-secondary">
          {user.is_guest ? "Guest account" : "Registered account"}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          {customerDetailHref ? (
            <ViewCustomerLink
              href={customerDetailHref}
              label={`View ${user.full_name ?? user.email ?? "customer"}`}
            />
          ) : null}
          {user.status === "deactivated" ? (
            <ActionButton
              icon="reactivate"
              label="Reactivate"
              onClick={() => onAction("reactivate", user)}
              tone="success"
            />
          ) : user.status !== "deleted" ? (
            <ActionButton
              icon="deactivate"
              label="Deactivate"
              onClick={() => onAction("deactivate", user)}
              tone="warning"
            />
          ) : null}
          <ActionButton
            icon="delete"
            label="Hard delete"
            onClick={() => onAction("delete", user)}
            tone="error"
          />
        </div>
      </td>
    </tr>
  );
}
