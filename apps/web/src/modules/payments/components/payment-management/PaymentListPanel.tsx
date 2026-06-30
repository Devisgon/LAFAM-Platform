"use client";

import { useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";
import type { AdminUser } from "@/modules/users";

import { adminPaymentsClient, type AdminPaymentFilters, type PaymentMethod } from "../../api/paymentsApi";
import { paymentMethods, pageSizeOptions } from "../../constants/paymentUi.constants";
import { useAdminPayments } from "../../hooks/useAdminPayments";
import type { ResultToast } from "../../types/paymentUi.types";
import { getErrorMessage, getPaymentUserName, label } from "../../utils/paymentFormatters";
import { DateField, FilterSelect, PaginationFooter, RetryState } from "./PaymentControls";
import { PaymentDetailPanel } from "./PaymentDetailPanel";
import { PaymentRow } from "./PaymentTableRows";

export function PaymentListPanel({
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
