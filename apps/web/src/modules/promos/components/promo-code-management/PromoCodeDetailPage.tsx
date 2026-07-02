"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { useAdminUsers } from "@/modules/users";
import type { PromoCode, PromoCodeRedemption } from "../../api/promoCodesApi";
import { useAdminPromoCodeDetail } from "../../hooks/useAdminPromoCodeDetail";
import {
  formatDateTime,
  formatDiscount,
  formatMoney,
  getMaxUsage,
  getUsageCount,
  label,
  statusTone,
} from "../../utils/promoFormatters";
import { RetryState } from "./PromoCodeControls";

function getUserDisplayName(
  userId: string | null,
  userNames: Map<string, string>,
): string {
  if (!userId) return "Unknown customer";

  return userNames.get(userId) ?? userId;
}

function getPaymentLabel(redemption: PromoCodeRedemption): string {
  return redemption.payment_number ?? redemption.payment_id;
}

function getMoneyLabel(value: number | null): string {
  return value === null ? "Not available" : formatMoney(value);
}

export function PromoCodeDetailPage({ promoCodeId }: { promoCodeId: string }) {
  const redemptionFilters = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      sort_by: "created_at" as const,
      sort_direction: "desc" as const,
      status: "redeemed" as const,
    }),
    [],
  );
  const userFilters = useMemo(() => ({}), []);
  const { users } = useAdminUsers(userFilters);
  const {
    error,
    isLoading,
    loadPromoCodeDetail,
    promoCode,
    redemptions,
    totalRedemptions,
  } = useAdminPromoCodeDetail(promoCodeId, redemptionFilters);

  const userNames = useMemo(
    () =>
      new Map(
        users.map((user) => [
          user.id,
          user.full_name || user.email || user.phone || user.id,
        ]),
      ),
    [users],
  );

  if (isLoading) {
    return <LoadingState className="p-6" label="Loading promo code" />;
  }

  if (error || !promoCode) {
    return (
      <RetryState
        error={error ?? "The requested promo code was not found."}
        onRetry={() => void loadPromoCodeDetail().catch(() => undefined)}
      />
    );
  }

  return (
    <section className="grid gap-5">
      <header className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <div className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-sm font-semibold text-txt-primary shadow-sm transition hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/promos"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              Promo Codes
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-txt-primary">
                {promoCode.code}
              </h1>
              <Badge tone={statusTone(promoCode.status)}>
                {label(promoCode.status)}
              </Badge>
            </div>
            {promoCode.description ? (
              <p className="mt-2 max-w-3xl text-sm text-txt-secondary">
                {promoCode.description}
              </p>
            ) : null}
          </div>
          <div className="rounded-sm border border-background-secondary bg-card-bg-primary px-4 py-3 text-sm">
            <span className="block text-xs font-bold uppercase text-txt-secondary">
              Usage
            </span>
            <span className="mt-1 block text-lg font-semibold text-txt-primary">
              {getUsageCount(promoCode)} / {getMaxUsage(promoCode) ?? "Unlimited"}
            </span>
          </div>
        </div>
        <PromoDetailGrid promoCode={promoCode} />
      </header>

      <section
        aria-label="Promo redemption history"
        className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
      >
        <header className="flex flex-col gap-2 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-txt-primary">
              Redemption History
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              {totalRedemptions} redeemed payments found for this promo code.
            </p>
          </div>
        </header>
        <DataTable
          columnHeaderClassName="bg-card-bg-secondary px-4 py-3.5 text-sm font-semibold tracking-wider text-txt-primary"
          columns={[
            { heading: "Name", key: "name" },
            { heading: "Type", key: "type" },
            { heading: "Payment", key: "payment" },
            { heading: "Status", key: "status" },
            { heading: "Subtotal", key: "subtotal" },
            { heading: "Discount", key: "discount" },
            { heading: "Final", key: "final" },
            { heading: "Method", key: "method" },
          ]}
          emptyMessage="No redemptions found."
          headerRowClassName="bg-card-bg-secondary text-txt-primary border-b border-background-secondary divide-x divide-background-secondary"
          isEmpty={redemptions.length === 0}
          minWidthClassName="min-w-[980px]"
          wrapperClassName="overflow-x-auto px-5 py-5"
        >
          {redemptions.map((redemption) => (
            <tr
              className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40"
              key={redemption.id}
            >
              <td className="px-4 py-4 font-semibold text-txt-primary">
                {getUserDisplayName(redemption.user_id, userNames)}
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {redemption.type ? label(redemption.type) : "Not available"}
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {getPaymentLabel(redemption)}
              </td>
              <td className="px-4 py-4">
                <Badge tone="success">{label(redemption.status)}</Badge>
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {getMoneyLabel(redemption.subtotal)}
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {formatMoney(redemption.discount)}
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {getMoneyLabel(redemption.final)}
              </td>
              <td className="px-4 py-4 text-txt-primary">
                {redemption.method ? label(redemption.method) : "Not available"}
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </section>
  );
}

function PromoDetailGrid({ promoCode }: { promoCode: PromoCode }) {
  return (
    <dl className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
      <DetailItem
        label="Discount"
        value={formatDiscount(
          promoCode.discount_type,
          promoCode.discount_value,
        )}
      />
      <DetailItem
        label="Maximum discount"
        value={formatMoney(promoCode.max_discount_amount)}
      />
      <DetailItem
        label="Minimum order"
        value={formatMoney(promoCode.minimum_order_amount)}
      />
      <DetailItem
        label="Per user limit"
        value={String(promoCode.per_user_limit ?? "No limit")}
      />
      <DetailItem label="Starts at" value={formatDateTime(promoCode.starts_at)} />
      <DetailItem label="Ends at" value={formatDateTime(promoCode.ends_at)} />
      <DetailItem
        label="Payment methods"
        value={promoCode.allowed_payment_methods.map(label).join(", ") || "Any"}
      />
      <DetailItem
        label="Target types"
        value={promoCode.allowed_target_types.map(label).join(", ") || "Any"}
      />
      <DetailItem
        label="First-time only"
        value={promoCode.first_time_customer_only ? "Yes" : "No"}
      />
      <DetailItem label="Created at" value={formatDateTime(promoCode.created_at)} />
      <DetailItem label="Updated at" value={formatDateTime(promoCode.updated_at)} />
      <DetailItem
        label="Admin notes"
        value={promoCode.admin_notes ?? "Not provided"}
      />
    </dl>
  );
}

function DetailItem({
  label: itemLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-background-secondary bg-card-bg-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-txt-primary">
        {value}
      </dd>
    </div>
  );
}
