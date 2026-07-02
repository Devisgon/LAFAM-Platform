"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Eye,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  UserX,
} from "lucide-react";
import { ConfirmationCard } from "@/components/feedback/ConfirmationCard";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";

import type { CustomerAuthStatus, CustomerProfile } from "../api/customersApi";
import { fieldClass } from "../constants/customerUi.constants";
import { useAdminCustomers } from "../hooks/useAdminCustomers";
import type { ResultToast } from "../types/customerUi.types";
import {
  buildCreatePayload,
  getErrorMessage,
} from "../utils/customerPayload";
import { CustomerCreateForm } from "./customer-management/CustomerCreateForm";

const pageSizeOptions = [10, 20, 50] as const;
const customerStatuses: CustomerAuthStatus[] = [
  "active",
  "invited",
  "pending_email_verification",
  "deactivated",
  "guest_active",
];

type CustomerAction = "deactivate" | "reactivate" | "delete";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function statusTone(
  status: CustomerAuthStatus,
): "success" | "warning" | "error" | "neutral" | "info" {
  if (status === "active" || status === "guest_active") return "success";
  if (status === "invited" || status === "pending_email_verification") {
    return "info";
  }
  if (status === "deactivated") return "warning";
  if (status === "deleted") return "error";
  return "neutral";
}

function contactLabel(customer: CustomerProfile): string {
  return customer.phone || customer.email || "Not provided";
}

function canShowCustomerActions(customer: CustomerProfile): boolean {
  return customer.auth_status !== "invited";
}

function actionLabel(action: CustomerAction): string {
  if (action === "reactivate") return "activate";
  return action;
}

function IconButton({
  children,
  label: actionLabelText,
  onClick,
  tone = "primary",
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "primary" | "warning" | "error";
}) {
  const tones = {
    error: "bg-error text-txt-primary",
    primary: "bg-primary text-txt-primary",
    warning: "bg-warning text-txt-primary",
  };

  return (
    <button
      aria-label={actionLabelText}
      className={`flex size-9 items-center justify-center rounded-full border border-background-secondary shadow-sm transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tones[tone]}`}
      onClick={onClick}
      title={actionLabelText}
      type="button"
    >
      {children}
    </button>
  );
}

export function AdminCustomerManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerAuthStatus | "">("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [pageSize, setPageSize] = useState<number>(pageSizeOptions[1]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    action: CustomerAction;
    customer: CustomerProfile;
  } | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const filters = useMemo(
    () => ({
      include_deleted: includeDeleted,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      ...(search.trim() ? { search } : {}),
      ...(status ? { auth_status: status } : {}),
    }),
    [currentPage, includeDeleted, pageSize, search, status],
  );

  const {
    customers,
    total,
    isLoading,
    isCreating,
    isMutating,
    error,
    loadCustomers,
    createCustomer,
    deactivateCustomer,
    reactivateCustomer,
    deleteCustomer,
    resendCustomerInvitation,
  } = useAdminCustomers(filters);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + customers.length,
    total,
  );

  const submitCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const created = await createCustomer(
        buildCreatePayload(new FormData(event.currentTarget)),
      );

      event.currentTarget.reset();
      setIsCreateOpen(false);
      setCurrentPage(1);
      setToast({
        title:
          created.auth_status === "invited"
            ? "Customer invite sent"
            : "Customer user created",
        message:
          created.auth_status === "invited"
            ? `${created.full_name} was invited by email.`
            : `${created.full_name} can log in immediately.`,
        tone: "success",
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
    } catch (requestError: unknown) {
      setToast({
        title: "Customer user not saved",
        message: getErrorMessage(requestError),
        tone: "error",
      });
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    const { action, customer } = pendingAction;

    try {
      if (action === "delete") {
        await deleteCustomer(customer.id);
      } else if (action === "deactivate") {
        await deactivateCustomer(customer.id);
      } else {
        await reactivateCustomer(customer.id);
      }

      setToast({
        title: "Customer updated",
        message: `${customer.full_name} was ${actionLabel(action)}d.`,
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        title: "Customer action failed",
        message: getErrorMessage(requestError),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const resendInvite = async (customer: CustomerProfile) => {
    const invitationId = customer.latest_invitation?.id;

    if (!invitationId) {
      setToast({
        title: "Invite not available",
        message: "This customer does not have an invitation record to resend.",
        tone: "error",
      });
      return;
    }

    try {
      await resendCustomerInvitation(invitationId);
      setToast({
        title: "Invite resent",
        message: `Invitation email was resent to ${customer.email}.`,
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        title: "Invite resend failed",
        message: getErrorMessage(requestError),
        tone: "error",
      });
    }
  };

  const resetToFirstPage = () => setCurrentPage(1);

  return (
    <>
      <section aria-label="Customer user creation" className="grid gap-5">
        {isCreateOpen ? (
          <CustomerCreateForm
            isSaving={isCreating}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={submitCustomer}
          />
        ) : (
          <section className="flex flex-col gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-medium">Add Customer User</h2>
              <p className="mt-1 text-sm text-txt-secondary">
                Create a verified customer or send a customer invitation.
              </p>
            </div>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={18} />
              Add customer user
            </button>
          </section>
        )}
      </section>

      <section
        aria-label="Customer list"
        className="mt-5 overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
      >
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <h2 className="text-2xl font-medium">Customer List</h2>
        </header>

        <div className="grid gap-3 border-b border-background-secondary px-5 py-5 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.25fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)]">
          <label>
            <span className="sr-only">Search customers</span>
            <input
              className={fieldClass}
              onChange={(event) => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
              placeholder="Search name, email, or phone..."
              type="search"
              value={search}
            />
          </label>
          <FilterSelect
            label="Status"
            onChange={(value) => {
              setStatus(value as CustomerAuthStatus | "");
              resetToFirstPage();
            }}
            options={[
              ["", "All statuses"],
              ...customerStatuses.map((item) => [item, label(item)] as const),
            ]}
            value={status}
          />
          <FilterSelect
            label="Deleted"
            onChange={(value) => {
              setIncludeDeleted(value === "true");
              resetToFirstPage();
            }}
            options={[
              ["false", "Active records"],
              ["true", "Include deleted"],
            ]}
            value={String(includeDeleted)}
          />
        </div>

        {isLoading ? (
          <LoadingState className="p-6" label="Loading customers" />
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-txt-primary" role="alert">
              {error}
            </p>
            <button
              className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
              onClick={() => void loadCustomers().catch(() => undefined)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <DataTable
              columnHeaderClassName="bg-card-bg-secondary px-4 py-3.5 text-sm font-semibold tracking-wider text-txt-primary"
              columns={[
                { heading: "Name", key: "name" },
                { heading: "Civil ID", key: "civil-id" },
                { heading: "Contact / Email", key: "contact" },
                { heading: "Status", key: "status" },
                { heading: "Role", key: "role" },
                {
                  className: "w-[180px] text-center",
                  heading: "Action",
                  key: "action",
                },
              ]}
              emptyMessage="No customers found."
              headerRowClassName="bg-card-bg-secondary text-txt-primary border-b border-background-secondary divide-x divide-background-secondary"
              isEmpty={customers.length === 0}
              minWidthClassName="min-w-[1040px]"
              wrapperClassName="overflow-x-auto px-5"
            >
              {customers.map((customer) => (
                <tr
                  className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40"
                  key={customer.id}
                >
                  <td className="px-4 py-4 font-semibold text-txt-primary">
                    {customer.full_name}
                  </td>
                  <td className="px-4 py-4 text-txt-primary">
                    {customer.civil_id}
                  </td>
                  <td className="px-4 py-4 text-txt-primary">
                    <span className="block">{contactLabel(customer)}</span>
                    {customer.phone && customer.email ? (
                      <span className="mt-0.5 block text-xs text-txt-secondary">
                        {customer.email}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={statusTone(customer.auth_status)}>
                      {label(customer.auth_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-txt-primary">
                    {customer.auth_status === "invited"
                      ? "Invited"
                      : label(customer.role)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {canShowCustomerActions(customer) ? (
                        <>
                          <Link
                            aria-label={`View ${customer.full_name}`}
                            className="flex size-9 items-center justify-center rounded-full border border-background-secondary bg-primary text-txt-primary shadow-sm transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            href={`/settings/customers/${encodeURIComponent(customer.id)}`}
                            title="View"
                          >
                            <Eye aria-hidden="true" size={17} strokeWidth={2.5} />
                          </Link>
                          {customer.auth_status === "deactivated" ? (
                            <IconButton
                              label={`Activate ${customer.full_name}`}
                              onClick={() =>
                                setPendingAction({
                                  action: "reactivate",
                                  customer,
                                })
                              }
                            >
                              <RotateCcw
                                aria-hidden="true"
                                size={17}
                                strokeWidth={2.5}
                              />
                            </IconButton>
                          ) : customer.auth_status !== "deleted" ? (
                            <IconButton
                              label={`Deactivate ${customer.full_name}`}
                              onClick={() =>
                                setPendingAction({
                                  action: "deactivate",
                                  customer,
                                })
                              }
                              tone="warning"
                            >
                              <UserX
                                aria-hidden="true"
                                size={17}
                                strokeWidth={2.5}
                              />
                            </IconButton>
                          ) : null}
                          {customer.auth_status !== "deleted" ? (
                            <IconButton
                              label={`Delete ${customer.full_name}`}
                              onClick={() =>
                                setPendingAction({ action: "delete", customer })
                              }
                              tone="error"
                            >
                              <Trash2
                                aria-hidden="true"
                                size={17}
                                strokeWidth={2.5}
                              />
                            </IconButton>
                          ) : null}
                        </>
                      ) : (
                        <IconButton
                          label={`Resend invite to ${customer.full_name}`}
                          onClick={() => void resendInvite(customer)}
                        >
                          <Send aria-hidden="true" size={17} strokeWidth={2.5} />
                        </IconButton>
                      )}
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
                Showing {visibleStart} to {visibleEnd} of {total} entries
              </p>

              <nav aria-label="Customer list pagination" className="flex items-center">
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

      {pendingAction ? (
        <section
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
        >
          <ConfirmationCard
            confirmLabel={`Yes, ${actionLabel(pendingAction.action)}`}
            description={`Are you sure you want to ${actionLabel(pendingAction.action)} ${pendingAction.customer.full_name}?${pendingAction.action === "delete" ? " This soft-deletes the customer record." : ""}`}
            loading={isMutating}
            onCancel={() => setPendingAction(null)}
            onConfirm={() => void confirmAction()}
            title={`${label(actionLabel(pendingAction.action))} customer?`}
            tone={pendingAction.action === "reactivate" ? "default" : "danger"}
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
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
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
