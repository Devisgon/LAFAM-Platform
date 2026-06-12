"use client";

import { useMemo, useState } from "react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  type AdminUser,
  type AdminUserFilters,
  type AdminUserRole,
  type AdminUserStatus,
} from "@/lib/admin-users";
import { Avatar } from "./reuseable_ui_components/avatar";
import { Badge } from "./reuseable_ui_components/badge";
import { ConfirmationCard } from "./reuseable_ui_components/confirmation_card";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";

type Confirmation = {
  action: "deactivate" | "reactivate" | "delete";
  user: AdminUser;
};

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const selectClass =
  "min-h-10 rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";

const roles: AdminUserRole[] = [
  "customer",
  "guest",
  "trainer",
  "stylist",
  "staff",
  "admin",
  "super_admin",
  "user",
];

const statuses: AdminUserStatus[] = [
  "active",
  "pending_email_verification",
  "guest_active",
  "deactivated",
  "deleted",
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(
  status: AdminUserStatus,
): "success" | "warning" | "error" | "info" {
  if (status === "active" || status === "guest_active") return "success";
  if (status === "deactivated" || status === "deleted") return "error";
  if (status === "pending_email_verification") return "warning";
  return "info";
}

export function AdminUserManager() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminUserRole | "">("");
  const [status, setStatus] = useState<AdminUserStatus | "">("");
  const [category, setCategory] = useState<"all" | "registered" | "guest">(
    "all",
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const filters = useMemo<AdminUserFilters>(
    () => ({
      ...(search.trim() ? { search } : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(category === "guest"
        ? { is_guest: true }
        : category === "registered"
          ? { is_guest: false }
          : {}),
    }),
    [category, role, search, status],
  );

  const {
    users,
    total,
    isLoading,
    isMutating,
    error,
    loadUsers,
    deactivateUser,
    reactivateUser,
    hardDeleteUser,
  } = useAdminUsers(filters);

  const runConfirmedAction = async () => {
    if (!confirmation) return;

    try {
      if (confirmation.action === "delete") {
        await hardDeleteUser(confirmation.user.id);
      } else if (confirmation.action === "deactivate") {
        await deactivateUser(confirmation.user.id);
      } else {
        await reactivateUser(confirmation.user.id);
      }

      setToast({
        title: "User updated",
        message: `${confirmation.user.full_name ?? confirmation.user.email ?? "User"} was ${confirmation.action === "delete" ? "permanently deleted" : `${confirmation.action}d`}.`,
        tone: "success",
      });
      setConfirmation(null);
    } catch (requestError: unknown) {
      setToast({
        title: "User action failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The user action failed.",
        tone: "error",
      });
      setConfirmation(null);
    }
  };

  return (
    <>
      <section className="mb-5 grid gap-3 rounded-xl border border-background-secondary bg-card-bg-secondary p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-bold">
          Search users
          <input
            className={selectClass}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Email, phone, or name"
            type="search"
            value={search}
          />
        </label>
        <FilterSelect
          label="Category"
          onChange={(value) =>
            setCategory(value as "all" | "registered" | "guest")
          }
          options={[
            ["all", "All categories"],
            ["registered", "Registered users"],
            ["guest", "Guest users"],
          ]}
          value={category}
        />
        <FilterSelect
          label="Role"
          onChange={(value) => setRole(value as AdminUserRole | "")}
          options={[
            ["", "All roles"],
            ...roles.map((item) => [item, label(item)] as [string, string]),
          ]}
          value={role}
        />
        <FilterSelect
          label="Status"
          onChange={(value) => setStatus(value as AdminUserStatus | "")}
          options={[
            ["", "All statuses"],
            ...statuses.map((item) => [item, label(item)] as [string, string]),
          ]}
          value={status}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-background-secondary bg-card-bg-primary shadow-sm">
        {isLoading ? (
          <LoadingState className="p-6" label="Loading users" />
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
            <button
              className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white"
              onClick={() => void loadUsers().catch(() => undefined)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-background-secondary bg-card-bg-secondary text-text-secondary">
                    {[
                      "User",
                      "Contact",
                      "Category",
                      "Status",
                      "Created",
                      "Actions",
                    ].map((heading) => (
                      <th className="px-5 py-3 font-bold" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary"
                      key={user.id}
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-3 font-bold">
                          <Avatar
                            alt={`${user.full_name ?? "User"} avatar`}
                            name={user.full_name ?? user.email ?? "User"}
                            size="sm"
                          />
                          <span>
                            {user.full_name ?? "Unnamed user"}
                            <span className="mt-0.5 block font-mono text-[10px] font-normal text-text-secondary">
                              {user.id}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <strong>{user.email ?? "No email"}</strong>
                        <span className="mt-0.5 block text-text-secondary">
                          {user.phone ?? "No phone"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <strong>{label(user.role)}</strong>
                        <span className="mt-0.5 block text-text-secondary">
                          {user.is_guest
                            ? "Guest account"
                            : "Registered account"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={statusTone(user.status)}>
                          {label(user.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-text-secondary">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.status === "deactivated" ? (
                            <ActionButton
                              label="Reactivate"
                              onClick={() =>
                                setConfirmation({ action: "reactivate", user })
                              }
                              tone="success"
                            />
                          ) : user.status !== "deleted" ? (
                            <ActionButton
                              label="Deactivate"
                              onClick={() =>
                                setConfirmation({ action: "deactivate", user })
                              }
                              tone="warning"
                            />
                          ) : null}
                          <ActionButton
                            label="Hard delete"
                            onClick={() =>
                              setConfirmation({ action: "delete", user })
                            }
                            tone="error"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-background-secondary px-5 py-3 text-xs text-text-secondary">
              Showing {users.length} of {total} users
            </footer>
          </>
        )}
      </section>

      {confirmation ? (
        <section
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
        >
          <ConfirmationCard
            confirmLabel={`Yes, ${confirmation.action}`}
            description={`Are you sure you want to ${confirmation.action} ${confirmation.user.full_name ?? confirmation.user.email ?? "this user"}?${confirmation.action === "delete" ? " Hard delete is permanent and requires super-admin access." : ""}`}
            loading={isMutating}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => void runConfirmedAction()}
            title={`${label(confirmation.action)} user?`}
            tone={confirmation.action === "reactivate" ? "default" : "danger"}
          />
        </section>
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

function FilterSelect({
  label: filterLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {filterLabel}
      <select
        className={selectClass}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  label: actionLabel,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: "success" | "warning" | "error";
}) {
  const tones = {
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
  };

  return (
    <button
      className={`font-bold hover:underline ${tones[tone]}`}
      onClick={onClick}
      type="button"
    >
      {actionLabel}
    </button>
  );
}
