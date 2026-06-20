"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  type AdminUser,
  type AdminUserFilters,
  type AdminUserRole,
  type AdminUserStatus,
} from "@/lib/admin-users";
import { Badge } from "./reuseable_ui_components/badge";
import { ConfirmationCard } from "./reuseable_ui_components/confirmation_card";
import { DataTable } from "./reuseable_ui_components/data_table";
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

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

const pageSizeOptions = [10, 25, 50];

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
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function usernameFromUser(user: AdminUser): string {
  return user.email?.split("@")[0] || user.phone || user.id.slice(0, 8);
}

function isActiveUser(user: AdminUser): boolean {
  return user.status !== "deactivated" && user.status !== "deleted";
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
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);

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
    isLoading,
    isMutating,
    error,
    loadUsers,
    deactivateUser,
    reactivateUser,
    hardDeleteUser,
  } = useAdminUsers(filters);

  const visibleUsers = useMemo(
    () => users.filter((user) => user.status !== "deleted"),
    [users],
  );
  const pageCount = Math.max(1, Math.ceil(visibleUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pagedUsers = visibleUsers.slice(pageStart, pageStart + pageSize);
  const visibleStart = visibleUsers.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(
    pageStart + pagedUsers.length,
    visibleUsers.length,
  );

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
      <section
        aria-label="User account list"
        className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
      >
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <h2 className="text-2xl font-medium">User List</h2>
        </header>

        {isLoading ? (
          <LoadingState className="p-6" label="Loading users" />
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-txt-primary" role="alert">
              {error}
            </p>
            <button
              className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
              onClick={() => void loadUsers().catch(() => undefined)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.25fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(190px,0.9fr)]">
                <label>
                  <span className="sr-only">Search users</span>
                  <input
                    className={fieldClass}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search..."
                    type="search"
                    value={search}
                  />
                </label>
                <FilterSelect
                  label="Category"
                  onChange={(value) => {
                    setCategory(value as "all" | "registered" | "guest");
                    setCurrentPage(1);
                  }}
                  options={[
                    ["all", "All categories"],
                    ["registered", "Registered users"],
                    ["guest", "Guest users"],
                  ]}
                  value={category}
                />
                <FilterSelect
                  label="Role"
                  onChange={(value) => {
                    setRole(value as AdminUserRole | "");
                    setCurrentPage(1);
                  }}
                  options={[
                    ["", "All roles"],
                    ...roles.map((item) => [item, label(item)] as [string, string]),
                  ]}
                  value={role}
                />
                <FilterSelect
                  label="Status"
                  onChange={(value) => {
                    setStatus(value as AdminUserStatus | "");
                    setCurrentPage(1);
                  }}
                  options={[
                    ["", "All statuses"],
                    ...statuses.map((item) => [item, label(item)] as [string, string]),
                  ]}
                  value={status}
                />
              </div>
            </div>

            <DataTable
              columnHeaderClassName="bg-card-bg-secondary px-4 py-3.5 text-sm font-semibold tracking-wider text-txt-primary"
              columns={[
                { className: "w-[180px] text-center", key: "active", heading: "Active/Inactive" },
                { className: "text-left", key: "full-name", heading: "Full Name" },
                { className: "text-left", key: "mobile", heading: "Mobile Number" },
                { className: "text-left", key: "email", heading: "Email" },
                { className: "text-left", key: "username", heading: "Username" },
                { className: "w-[120px] text-center", key: "password", heading: "Password" },
                { className: "text-left", key: "role", heading: "Role" },
                { className: "w-[140px] text-center", key: "action", heading: "Action" },
              ]}
              emptyMessage="No users found."
              headerRowClassName="bg-card-bg-secondary text-txt-primary border-b border-background-secondary divide-x divide-background-secondary"
              isEmpty={pagedUsers.length === 0}
              minWidthClassName="min-w-[1100px]"
              wrapperClassName="overflow-x-auto px-5"
            >
              {pagedUsers.map((user) => (
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
                            <Badge tone="neutral">
                              {label(user.status)}
                            </Badge>
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
                        <td className="px-4 py-4 text-txt-primary">
                          {usernameFromUser(user)}
                        </td>
                        <td className="px-4 py-4 text-center text-txt-secondary text-sm font-mono tracking-wider">
                          ••••••••
                        </td>
                        <td className="px-4 py-4 text-txt-primary">
                          <span className="block font-medium capitalize">{label(user.role)}</span>
                          <span className="mt-0.5 block text-xs text-txt-secondary">
                            {user.is_guest ? "Guest account" : "Registered account"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {user.status === "deactivated" ? (
                              <ActionButton
                                icon="reactivate"
                                label="Reactivate"
                                onClick={() =>
                                  setConfirmation({ action: "reactivate", user })
                                }
                                tone="success"
                              />
                            ) : user.status !== "deleted" ? (
                              <ActionButton
                                icon="deactivate"
                                label="Deactivate"
                                onClick={() =>
                                  setConfirmation({ action: "deactivate", user })
                                }
                                tone="warning"
                              />
                            ) : null}
                            <ActionButton
                              icon="delete"
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
            </DataTable>

            <footer className="flex flex-col gap-4 px-5 py-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
              <label className="flex items-center gap-4">
                <span className="relative inline-flex">
                  <select
                    aria-label="Records per page"
                    className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    value={pageSize}
                  >
                    {pageSizeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                    size={16}
                  />
                </span>
                records per page
              </label>

              <p>
                Showing {visibleStart} to {visibleEnd} of {visibleUsers.length} entries
              </p>

              <nav aria-label="User list pagination" className="flex items-center">
                <button
                  className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage(() => Math.max(1, safeCurrentPage - 1))
                  }
                  type="button"
                >
                  Previous
                </button>
                <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
                  {safeCurrentPage}
                </span>
                <button
                  className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage >= pageCount}
                  onClick={() =>
                    setCurrentPage(() => Math.min(pageCount, safeCurrentPage + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </nav>
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
    <label className="relative">
      <span className="sr-only">{filterLabel}</span>
      <select
        aria-label={filterLabel}
        className={`${fieldClass} appearance-none pr-10`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
        size={16}
      />
    </label>
  );
}

function ActionButton({
  icon,
  label: actionLabel,
  onClick,
  tone,
}: {
  icon: "deactivate" | "reactivate" | "delete";
  label: string;
  onClick: () => void;
  tone: "success" | "warning" | "error";
}) {
  const tones = {
    success: "bg-success text-txt-primary hover:opacity-85",
    warning: "bg-warning text-txt-primary hover:opacity-85",
    error: "bg-error text-txt-primary hover:opacity-85",
  };
  const Icon =
    icon === "reactivate" ? RotateCcw : icon === "delete" ? Trash2 : Power;

  return (
    <button
      aria-label={actionLabel}
      className={`flex size-9 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shadow-sm ${tones[tone]}`}
      onClick={onClick}
      title={actionLabel}
      type="button"
    >
      <Icon aria-hidden="true" size={17} strokeWidth={2.5} />
    </button>
  );
}
