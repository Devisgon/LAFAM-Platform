"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";

import type { AdminPaymentTransactionFilters, PaymentTransactionStatus, PaymentTransactionType } from "../../api/paymentsApi";
import { transactionStatuses, transactionTypes, pageSizeOptions } from "../../constants/paymentUi.constants";
import { useAdminPaymentTransactions } from "../../hooks/useAdminPayments";
import { formatDateTime, label, statusTone } from "../../utils/paymentFormatters";
import { FilterSelect, PaginationFooter, RetryState } from "./PaymentControls";

export function PaymentTransactionsSection({ paymentId }: { paymentId: string }) {
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
