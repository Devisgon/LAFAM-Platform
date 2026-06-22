"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import {
  useAdminPayments,
  useAdminPaymentTransactions,
} from "@/modules/payments";
import {
  useAdminBookings,
  useAdminPrivateBookings,
} from "@/modules/bookings";
import { useAdminUsers } from "@/modules/users";
import {
  adminPaymentsClient,
  type AdminPaymentFilters,
  type AdminPaymentTransactionFilters,
  type PaymentDetail,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentSummary,
  type PaymentTransactionStatus,
  type PaymentTransactionType,
} from "@/modules/payments";
import {
  type AdminBooking,
  type AdminBookingFilters,
  type AdminPrivateBookingFilters,
  type PrivateTrainerBooking,
} from "@/modules/bookings";
import { type AdminUser, type AdminUserFilters } from "@/modules/users";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

const pageSizeOptions = [10, 25, 50];

const paymentMethods: PaymentMethod[] = ["knet", "card", "wallet"];
const transactionTypes: PaymentTransactionType[] = [
  "intent_created",
  "provider_request",
  "provider_response",
  "callback_received",
  "webhook_received",
  "verification",
  "status_change",
  "wallet_debit",
  "wallet_credit",
  "refund_requested",
  "refund_processed",
  "refund_failed",
];
const transactionStatuses: PaymentTransactionStatus[] = [
  "pending",
  "succeeded",
  "failed",
  "ignored",
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The payment request failed.";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

function getUserDisplayName(user?: AdminUser): string {
  if (!user) return "Unknown user";

  return (
    user.full_name ??
    user.email ??
    user.phone ??
    `User ${user.id.slice(0, 8)}`
  );
}

function getUserOptionLabel(user: AdminUser): string {
  const name = getUserDisplayName(user);

  if (user.email && user.email !== name) return `${name} - ${user.email}`;
  if (user.phone && user.phone !== name) return `${name} - ${user.phone}`;

  return name;
}

function getPaymentUserName(
  userId: string,
  usersById: Map<string, AdminUser>,
): string {
  const user = usersById.get(userId);

  return user ? getUserDisplayName(user) : `User ${userId.slice(0, 8)}`;
}

function getBookingCustomerName(
  booking: AdminBooking | PrivateTrainerBooking,
): string {
  return (
    booking.customer?.full_name ??
    booking.customer?.email ??
    booking.customer?.phone ??
    "Unknown customer"
  );
}

function getBookingOptionLabel(
  booking: AdminBooking | PrivateTrainerBooking,
): string {
  return `${getBookingCustomerName(booking)} - ${booking.booking_number}`;
}

function statusTone(
  status: PaymentStatus | PaymentTransactionStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "paid" || status === "succeeded") return "success";
  if (
    status === "pending" ||
    status === "requires_redirect" ||
    status === "processing" ||
    status === "refund_requested" ||
    status === "refund_processing"
  ) {
    return "warning";
  }
  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "manual_refund_required"
  ) {
    return "error";
  }
  if (status === "refunded" || status === "ignored") return "info";
  return "neutral";
}

export function AdminPaymentManager() {
  const userFilters = useMemo<AdminUserFilters>(() => ({}), []);
  const bookingFilters = useMemo<AdminBookingFilters>(
    () => ({
      limit: 100,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
    }),
    [],
  );
  const privateBookingFilters = useMemo<AdminPrivateBookingFilters>(
    () => ({
      limit: 100,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
    }),
    [],
  );
  const {
    users,
    error: usersError,
    isLoading: areUsersLoading,
  } = useAdminUsers(userFilters);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const userOptions = useMemo(
    () => users.map((user) => [user.id, getUserOptionLabel(user)] as const),
    [users],
  );
  const {
    bookings,
    error: bookingsError,
    isLoading: areBookingsLoading,
  } = useAdminBookings(bookingFilters);
  const {
    bookings: privateBookings,
    error: privateBookingsError,
    isLoading: arePrivateBookingsLoading,
  } = useAdminPrivateBookings(privateBookingFilters);
  const bookingOptions = useMemo(
    () =>
      bookings.map(
        (booking) => [booking.id, getBookingOptionLabel(booking)] as const,
      ),
    [bookings],
  );
  const privateBookingOptions = useMemo(
    () =>
      privateBookings.map(
        (booking) => [booking.id, getBookingOptionLabel(booking)] as const,
      ),
    [privateBookings],
  );

  return (
    <PaymentListPanel
      areBookingsLoading={areBookingsLoading}
      arePrivateBookingsLoading={arePrivateBookingsLoading}
      areUsersLoading={areUsersLoading}
      bookingOptions={bookingOptions}
      bookingsError={bookingsError}
      privateBookingOptions={privateBookingOptions}
      privateBookingsError={privateBookingsError}
      userOptions={userOptions}
      usersById={usersById}
      usersError={usersError}
    />
  );
}

function PaymentListPanel({
  areBookingsLoading,
  arePrivateBookingsLoading,
  areUsersLoading,
  bookingOptions,
  bookingsError,
  privateBookingOptions,
  privateBookingsError,
  userOptions,
  usersById,
  usersError,
}: {
  areBookingsLoading: boolean;
  arePrivateBookingsLoading: boolean;
  areUsersLoading: boolean;
  bookingOptions: ReadonlyArray<readonly [string, string]>;
  bookingsError: string | null;
  privateBookingOptions: ReadonlyArray<readonly [string, string]>;
  privateBookingsError: string | null;
  userOptions: ReadonlyArray<readonly [string, string]>;
  usersById: Map<string, AdminUser>;
  usersError: string | null;
}) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null,
  );
  const [userId, setUserId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [bookingId, setBookingId] = useState("");
  const [privateBookingId, setPrivateBookingId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExpiring, setIsExpiring] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const filters = useMemo<AdminPaymentFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(userId ? { user_id: userId } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      ...(bookingId.trim() ? { booking_id: bookingId } : {}),
      ...(privateBookingId.trim()
        ? { private_booking_id: privateBookingId }
        : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [
      bookingId,
      currentPage,
      fromDate,
      pageSize,
      paymentMethod,
      privateBookingId,
      toDate,
      userId,
    ],
  );
  const { error, isLoading, loadPayments, payments, total } =
    useAdminPayments(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + payments.length,
    total,
  );
  const resetToFirstPage = () => setCurrentPage(1);

  const expireUnpaid = async () => {
    setIsExpiring(true);

    try {
      const expiredPayments = await adminPaymentsClient.expireUnpaid();
      setToast({
        message: `${expiredPayments.length} unpaid payment intent${expiredPayments.length === 1 ? "" : "s"} expired.`,
        title: "Unpaid payments expired",
        tone: "success",
      });
      await loadPayments();
    } catch (requestError: unknown) {
      setToast({
        message: getErrorMessage(requestError),
        title: "Expire action failed",
        tone: "error",
      });
    } finally {
      setIsExpiring(false);
    }
  };

  if (selectedPaymentId) {
    return (
      <PaymentDetailPanel
        onBack={() => setSelectedPaymentId(null)}
        onChanged={() => void loadPayments().catch(() => undefined)}
        paymentId={selectedPaymentId}
        usersById={usersById}
      />
    );
  }

  return (
    <section
      aria-label="Admin payment records"
      className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-medium text-txt-primary">
            Payment Records
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Review payments across customers and open complete transaction
            billing details.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isExpiring}
          onClick={() => void expireUnpaid()}
          type="button"
        >
          <ReceiptText aria-hidden="true" size={18} />
          {isExpiring ? "Expiring..." : "Expire unpaid"}
        </button>
      </header>

      <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            <FilterSelect
              disabled={areUsersLoading || userOptions.length === 0}
              label="User"
              onChange={(value) => {
                setUserId(value);
                resetToFirstPage();
              }}
              options={[
                ["", areUsersLoading ? "Loading users..." : "All users"],
                ...userOptions,
              ]}
              value={userId}
            />
            <FilterSelect
              label="Payment method"
              onChange={(value) => {
                setPaymentMethod(value as PaymentMethod | "");
                resetToFirstPage();
              }}
              options={[
                ["", "All methods"],
                ...paymentMethods.map((item) => [item, label(item)] as const),
              ]}
              value={paymentMethod}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            disabled={areBookingsLoading}
            label="Booking ID"
            onChange={(value) => {
              setBookingId(value);
              resetToFirstPage();
            }}
            options={[
              ["", areBookingsLoading ? "Loading bookings..." : "All class bookings"],
              ...bookingOptions,
            ]}
            value={bookingId}
          />
          <FilterSelect
            disabled={arePrivateBookingsLoading}
            label="Private booking ID"
            onChange={(value) => {
              setPrivateBookingId(value);
              resetToFirstPage();
            }}
            options={[
              [
                "",
                arePrivateBookingsLoading
                  ? "Loading private bookings..."
                  : "All private bookings",
              ],
              ...privateBookingOptions,
            ]}
            value={privateBookingId}
          />
          <DateField
            label="From date"
            onChange={(value) => {
              setFromDate(value);
              resetToFirstPage();
            }}
            value={fromDate}
          />
          <DateField
            label="To date"
            onChange={(value) => {
              setToDate(value);
              resetToFirstPage();
            }}
            value={toDate}
          />
        </div>

        {usersError || bookingsError || privateBookingsError ? (
          <p className="text-sm text-error" role="alert">
            {usersError ?? bookingsError ?? privateBookingsError}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState className="p-6" label="Loading payment records" />
      ) : error ? (
        <RetryState
          error={error}
          onRetry={() => void loadPayments().catch(() => undefined)}
        />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "name", heading: "Name" },
              { key: "amount", heading: "Amount" },
              { key: "payment-type", heading: "Payment Type" },
              { key: "method", heading: "Method" },
              { key: "status", heading: "Status" },
              { key: "payment-number", heading: "Payment No." },
              { key: "created", heading: "Created" },
              {
                className: "w-[120px] text-center",
                key: "action",
                heading: "Action",
              },
            ]}
            emptyMessage="No payment records found."
            isEmpty={payments.length === 0}
            minWidthClassName="min-w-[1080px]"
          >
            {payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                onView={() => setSelectedPaymentId(payment.id)}
                payment={payment}
                userName={getPaymentUserName(payment.user_id, usersById)}
              />
            ))}
          </DataTable>

          <PaginationFooter
            currentPage={safeCurrentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setCurrentPage(1);
            }}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            visibleEnd={visibleEnd}
            visibleStart={visibleStart}
          />
        </>
      )}

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
    </section>
  );
}

function PaymentRow({
  onView,
  payment,
  userName,
}: {
  onView: () => void;
  payment: PaymentSummary;
  userName: string;
}) {
  return (
    <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40">
      <td className="px-4 py-4 font-medium text-txt-primary">{userName}</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">
        {formatMoney(payment.final_amount)}
      </td>
      <td className="px-4 py-4 text-txt-primary">{label(payment.target_type)}</td>
      <td className="px-4 py-4 text-txt-primary">
        {label(payment.payment_method)}
      </td>
      <td className="px-4 py-4">
        <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {payment.payment_number}
      </td>
      <td className="px-4 py-4 text-txt-secondary">
        {formatDateTime(payment.created_at)}
      </td>
      <td className="px-4 py-4 text-center">
        <button
          className="min-h-9 rounded-sm bg-button-primary px-4 text-xs font-bold text-txt-primary transition hover:opacity-85"
          onClick={onView}
          type="button"
        >
          View
        </button>
      </td>
    </tr>
  );
}

function PaymentDetailPanel({
  onBack,
  onChanged,
  paymentId,
  usersById,
}: {
  onBack: () => void;
  onChanged: () => void;
  paymentId: string;
  usersById: Map<string, AdminUser>;
}) {
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const loadPayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setPayment(await adminPaymentsClient.get(paymentId));
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const request = window.setTimeout(() => {
      void loadPayment();
    }, 0);

    return () => window.clearTimeout(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  if (isLoading) {
    return (
      <section className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <LoadingState className="p-6" label="Loading payment detail" />
      </section>
    );
  }

  if (!payment) {
    return (
      <section className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <RetryState
          error={error ?? "Payment detail could not be loaded."}
          onRetry={() => void loadPayment()}
        />
        <div className="px-6 pb-6">
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary"
            onClick={onBack}
            type="button"
          >
            Back to payments
          </button>
        </div>
      </section>
    );
  }

  const userName = getPaymentUserName(payment.user_id, usersById);

  return (
    <section className="overflow-hidden rounded-md bg-card-bg-primary text-txt-primary shadow-sm">
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Billing detail
          </p>
          <h2 className="mt-1 text-2xl font-medium">{payment.payment_number}</h2>
          <p className="mt-1 text-sm text-txt-secondary">
            {userName} - {payment.receipt_number ?? "No receipt yet"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
            <Badge tone="neutral">{label(payment.target_type)}</Badge>
            <Badge tone="neutral">{label(payment.payment_method)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary transition hover:bg-background-secondary"
            onClick={onBack}
            type="button"
          >
            Back to payments
          </button>
          <button
            className="min-h-11 rounded-sm bg-button-primary px-5 text-sm font-semibold text-txt-primary transition hover:opacity-85"
            onClick={() => setRefundOpen(true)}
            type="button"
          >
            Refund
          </button>
        </div>
      </header>

      {error ? (
        <p
          className="mx-5 mt-5 rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-5">
          <section className="rounded-md border border-background-secondary">
            <header className="border-b border-background-secondary px-4 py-3">
              <h3 className="font-semibold">Payment information</h3>
            </header>
            <dl className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Name" value={userName} />
              <DetailItem label="Transaction ID" value={payment.gateway_reference ?? "None"} />
              <DetailItem label="Payment method" value={label(payment.payment_method)} />
              <DetailItem label="Payment provider" value={label(payment.payment_provider)} />
              <DetailItem label="Status" value={label(payment.status)} />
              <DetailItem label="Booking reference" value={payment.booking_id ?? payment.private_booking_id ?? "None"} />
              <DetailItem label="Created" value={formatDateTime(payment.created_at)} />
            </dl>
          </section>

          <section className="rounded-md border border-background-secondary">
            <header className="border-b border-background-secondary px-4 py-3">
              <h3 className="font-semibold">Timeline and refund data</h3>
            </header>
            <dl className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Paid time" value={formatDateTime(payment.paid_at)} />
              <DetailItem label="Expired time" value={formatDateTime(payment.expired_at)} />
              <DetailItem label="Expires at" value={formatDateTime(payment.expires_at)} />
              <DetailItem label="Failed time" value={formatDateTime(payment.failed_at)} />
              <DetailItem label="Cancelled time" value={formatDateTime(payment.cancelled_at)} />
              <DetailItem label="Refunded time" value={formatDateTime(payment.refunded_at)} />
              <DetailItem label="Refund amount" value={formatMoney(payment.refunded_amount)} />
              <DetailItem label="Failure" value={payment.failure_message ?? payment.failure_code ?? "None"} />
            </dl>
          </section>
        </section>

        <aside className="h-fit rounded-md border border-background-secondary bg-card-bg-secondary">
          <header className="border-b border-background-secondary px-4 py-4">
            <h3 className="text-xl font-semibold">Billing summary</h3>
          </header>
          <dl className="grid gap-3 p-4">
            <BillingLine label="Amount" value={formatMoney(payment.amount)} />
            <BillingLine
              label="Discount"
              value={`-${formatMoney(payment.discount_amount)}`}
            />
            <BillingLine
              emphasized
              label="Total amount"
              value={formatMoney(payment.final_amount)}
            />
            <BillingLine
              label="Currency"
              value={payment.currency}
            />
          </dl>
          <section className="border-t border-background-secondary p-4">
            <h4 className="text-sm font-bold">Discounts</h4>
            <div className="mt-3 grid gap-3">
              {payment.discounts && payment.discounts.length > 0 ? (
                payment.discounts.map((discount) => (
                  <div
                    className="rounded-sm bg-card-bg-primary p-3 text-sm"
                    key={discount.id}
                  >
                    <p className="font-semibold">{discount.code}</p>
                    <p className="text-txt-secondary">
                      {formatMoney(discount.discount_amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-txt-secondary">No discounts.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="mx-5 mb-5">
        <PaymentTransactionsSection paymentId={payment.id} />
      </div>

      {refundOpen ? (
        <RefundDialog
          onClose={() => setRefundOpen(false)}
          onRefunded={(updatedPayment) => {
            setRefundOpen(false);
            setPayment((current) =>
              current ? { ...current, ...updatedPayment } : current,
            );
            setToast({
              message: `${updatedPayment.payment_number} refund status is ${label(updatedPayment.status)}.`,
              title: "Refund processed",
              tone: "success",
            });
            onChanged();
            void loadPayment();
          }}
          payment={payment}
        />
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
    </section>
  );
}

function PaymentTransactionsSection({ paymentId }: { paymentId: string }) {
  const [transactionType, setTransactionType] = useState<
    PaymentTransactionType | ""
  >("");
  const [transactionStatus, setTransactionStatus] = useState<
    PaymentTransactionStatus | ""
  >("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const filters = useMemo<AdminPaymentTransactionFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(transactionType ? { transaction_type: transactionType } : {}),
      ...(transactionStatus
        ? { transaction_status: transactionStatus }
        : {}),
    }),
    [currentPage, pageSize, transactionStatus, transactionType],
  );
  const { error, isLoading, loadTransactions, total, transactions } =
    useAdminPaymentTransactions(paymentId, filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + transactions.length,
    total,
  );

  return (
    <section className="rounded-md border border-background-secondary">
      <header className="grid gap-3 border-b border-background-secondary px-4 py-3 xl:grid-cols-[1fr_220px_220px_auto] xl:items-center">
        <h3 className="font-semibold">Payment transactions</h3>
        <FilterSelect
          label="Transaction type"
          onChange={(value) => {
            setTransactionType(value as PaymentTransactionType | "");
            setCurrentPage(1);
          }}
          options={[
            ["", "All transaction types"],
            ...transactionTypes.map((item) => [item, label(item)] as const),
          ]}
          value={transactionType}
        />
        <FilterSelect
          label="Transaction status"
          onChange={(value) => {
            setTransactionStatus(value as PaymentTransactionStatus | "");
            setCurrentPage(1);
          }}
          options={[
            ["", "All statuses"],
            ...transactionStatuses.map((item) => [item, label(item)] as const),
          ]}
          value={transactionStatus}
        />
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85"
          onClick={() => void loadTransactions().catch(() => undefined)}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
          Refresh
        </button>
      </header>

      {isLoading ? (
        <LoadingState className="p-6" label="Loading payment transactions" />
      ) : error ? (
        <RetryState
          error={error}
          onRetry={() => void loadTransactions().catch(() => undefined)}
        />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "transaction-id", heading: "Transaction ID" },
              { key: "payment-id", heading: "Payment ID" },
              { key: "type", heading: "Type" },
              { key: "provider", heading: "Provider" },
              { key: "status", heading: "Status" },
              { key: "provider-ref", heading: "Provider Ref" },
              { key: "processed", heading: "Processed" },
              { key: "created", heading: "Created" },
            ]}
            emptyMessage="No payment transactions found."
            headerRowClassName="divide-x divide-background-secondary border-b border-background-secondary"
            isEmpty={transactions.length === 0}
            minWidthClassName="min-w-[1040px]"
            textSizeClassName="text-sm"
            wrapperClassName="overflow-x-auto p-4"
          >
            {transactions.map((transaction) => (
              <tr
                className="divide-x divide-background-secondary odd:bg-background-secondary/20"
                key={transaction.id}
              >
                <td className="px-4 py-3 font-mono text-xs text-txt-secondary">
                  {transaction.id}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-txt-secondary">
                  {transaction.payment_id}
                </td>
                <td className="px-4 py-3 text-txt-primary">
                  {label(transaction.transaction_type)}
                </td>
                <td className="px-4 py-3 text-txt-primary">
                  {label(transaction.provider)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(transaction.transaction_status)}>
                    {label(transaction.transaction_status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-txt-secondary">
                  {transaction.provider_reference ?? "None"}
                </td>
                <td className="px-4 py-3 text-txt-secondary">
                  {formatDateTime(transaction.processed_at)}
                </td>
                <td className="px-4 py-3 text-txt-secondary">
                  {formatDateTime(transaction.created_at)}
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationFooter
            currentPage={safeCurrentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setCurrentPage(1);
            }}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            visibleEnd={visibleEnd}
            visibleStart={visibleStart}
          />
        </>
      )}
    </section>
  );
}

function RefundDialog({
  onClose,
  onRefunded,
  payment,
}: {
  onClose: () => void;
  onRefunded: (payment: PaymentSummary) => void;
  payment: PaymentDetail;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultIdempotencyKey = `refund-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${payment.id.slice(0, 8)}`;

  const submitRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const refundAmount = String(formData.get("refund_amount") ?? "").trim();
    const idempotencyKey = String(
      formData.get("idempotency_key") ?? "",
    ).trim();
    const source = String(formData.get("source") ?? "").trim();

    setIsSaving(true);
    setError(null);

    try {
      const updatedPayment = await adminPaymentsClient.refund(payment.id, {
        reason: String(formData.get("reason") ?? "").trim(),
        ...(refundAmount ? { refund_amount: Number(refundAmount) } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(source ? { metadata: { source } } : {}),
      });
      onRefunded(updatedPayment);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-2xl overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-xl"
        onSubmit={(event) => void submitRefund(event)}
      >
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <p className="text-sm font-semibold text-txt-secondary">
            Admin payment action
          </p>
          <h2 className="mt-1 text-2xl font-medium">Refund payment</h2>
          <p className="mt-2 text-sm text-txt-secondary">
            Total amount {formatMoney(payment.final_amount)}. Leave refund
            amount empty for the backend default refund flow.
          </p>
        </header>

        <div className="grid gap-4 px-5 py-5">
          {error ? (
            <p
              className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <label className="grid gap-1.5 text-xs font-bold">
            Audit reason
            <textarea
              className={`${fieldClass} min-h-28 resize-y py-3`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder="Customer refund approved by admin."
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold">
              Refund amount
              <input
                className={fieldClass}
                max={payment.final_amount}
                min="0.001"
                name="refund_amount"
                placeholder="Optional"
                step="0.001"
                type="number"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Idempotency key
              <input
                className={fieldClass}
                defaultValue={defaultIdempotencyKey}
                maxLength={120}
                minLength={8}
                name="idempotency_key"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
              Metadata source
              <input
                className={fieldClass}
                defaultValue="admin_payment_screen"
                maxLength={80}
                name="source"
              />
            </label>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-background-secondary px-5 py-5 sm:flex-row">
          <button
            className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Submit refund"}
          </button>
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </footer>
      </form>
    </section>
  );
}

function RetryState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-6">
      <p className="text-sm text-txt-primary" role="alert">
        {error}
      </p>
      <button
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
        onClick={onRetry}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={14} />
        Try again
      </button>
    </div>
  );
}

function BillingLine({
  emphasized = false,
  label: itemLabel,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${emphasized ? "border-t border-background-secondary pt-3 text-lg font-bold" : "text-sm"}`}
    >
      <dt className="text-txt-secondary">{itemLabel}</dt>
      <dd className="font-semibold text-txt-primary">{value}</dd>
    </div>
  );
}

function DetailItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-background-secondary bg-card-bg-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

function PaginationFooter({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageSize,
  total,
  visibleEnd,
  visibleStart,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageCount: number;
  pageSize: number;
  total: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  return (
    <footer className="flex flex-col gap-4 px-5 pb-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
      <label className="flex items-center gap-4">
        <span className="relative inline-flex">
          <select
            aria-label="Records per page"
            className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
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

      <nav aria-label="Payment pagination" className="flex items-center">
        <button
          className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          Previous
        </button>
        <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
          {currentPage}
        </span>
        <button
          className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          type="button"
        >
          Next
        </button>
      </nav>
    </footer>
  );
}

function FilterSelect({
  disabled = false,
  label: filterLabel,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
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
        className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={disabled}
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

function DateField({
  label: dateLabel,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{dateLabel}</span>
      <input
        aria-label={dateLabel}
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}
