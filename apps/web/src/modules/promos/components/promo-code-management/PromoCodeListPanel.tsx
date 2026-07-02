"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ConfirmationCard } from "@/components/feedback/ConfirmationCard";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import type {
  PromoCode,
  PromoCodeFilters,
  PromoCodeStatus,
  PromoDiscountType,
  PromoPaymentMethod,
  PromoTargetType,
  UpdatePromoCodePayload,
} from "../../api/promoCodesApi";
import {
  fieldClass,
  pageSizeOptions,
  promoDiscountTypes,
  promoPaymentMethods,
  promoStatuses,
  promoTargetTypes,
} from "../../constants/promoUi.constants";
import { useAdminPromoCodes } from "../../hooks/useAdminPromoCodes";
import type { PromoDialog, ResultToast } from "../../types/promoUi.types";
import { label } from "../../utils/promoFormatters";
import {
  FilterSelect,
  PaginationFooter,
  RetryState,
  SearchField,
} from "./PromoCodeControls";
import { PromoCodeRow } from "./PromoCodeTableRows";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The promo action failed.";
}

function toDateTimeInputValue(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

function toIsoOrNull(value: FormDataEntryValue | null): string | null {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildUpdatePayload(formData: FormData): UpdatePromoCodePayload {
  return {
    admin_notes: String(formData.get("admin_notes") ?? "").trim() || null,
    allowed_payment_methods: [
      formData.get("payment_method") as PromoPaymentMethod,
    ].filter(Boolean),
    allowed_target_types: [
      formData.get("target_type") as PromoTargetType,
    ].filter(Boolean),
    description: String(formData.get("description") ?? "").trim() || null,
    discount_type: formData.get("discount_type") as PromoDiscountType,
    discount_value: Number(formData.get("discount_value") ?? 0),
    ends_at: toIsoOrNull(formData.get("ends_at")),
    first_time_customer_only:
      formData.get("first_time_customer_only") === "on",
    max_discount_amount: numberOrNull(formData.get("max_discount_amount")),
    max_redemptions: numberOrNull(formData.get("max_redemptions")),
    minimum_order_amount: Number(formData.get("minimum_order_amount") ?? 0),
    per_user_limit: numberOrNull(formData.get("per_user_limit")),
    starts_at: toIsoOrNull(formData.get("starts_at")),
    status: formData.get("status") as PromoCodeStatus,
  };
}

export function PromoCodeListPanel() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PromoCodeStatus | "">("");
  const [discountType, setDiscountType] = useState<PromoDiscountType | "">("");
  const [targetType, setTargetType] = useState<PromoTargetType | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PromoPaymentMethod | "">(
    "",
  );
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [pageSize, setPageSize] = useState<number>(pageSizeOptions[1]);
  const [currentPage, setCurrentPage] = useState(1);
  const [dialog, setDialog] = useState<PromoDialog | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const filters = useMemo<PromoCodeFilters>(
    () => ({
      include_deleted: includeDeleted,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(search.trim() ? { search } : {}),
      ...(status ? { status } : {}),
      ...(discountType ? { discount_type: discountType } : {}),
      ...(targetType ? { target_type: targetType } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    }),
    [
      currentPage,
      discountType,
      includeDeleted,
      pageSize,
      paymentMethod,
      search,
      status,
      targetType,
    ],
  );

  const {
    activatePromoCode,
    deletePromoCode,
    error,
    isLoading,
    isMutating,
    loadPromoCodes,
    pausePromoCode,
    promoCodes,
    total,
    updatePromoCode,
  } = useAdminPromoCodes(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + promoCodes.length,
    total,
  );
  const resetToFirstPage = () => setCurrentPage(1);

  const togglePromoCode = async (promoCode: PromoCode) => {
    try {
      const updated =
        promoCode.status === "active"
          ? await pausePromoCode(promoCode.id)
          : await activatePromoCode(promoCode.id);
      setToast({
        message: `${updated.code} is now ${label(updated.status)}.`,
        title: "Promo status updated",
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        message: getErrorMessage(requestError),
        title: "Promo status failed",
        tone: "error",
      });
    }
  };

  const submitUpdate = async (
    event: FormEvent<HTMLFormElement>,
    promoCode: PromoCode,
  ) => {
    event.preventDefault();

    try {
      const updated = await updatePromoCode(
        promoCode.id,
        buildUpdatePayload(new FormData(event.currentTarget)),
      );
      setDialog(null);
      setToast({
        message: `${updated.code} was updated.`,
        title: "Promo updated",
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        message: getErrorMessage(requestError),
        title: "Promo update failed",
        tone: "error",
      });
    }
  };

  const confirmDelete = async () => {
    if (dialog?.type !== "delete") return;

    try {
      await deletePromoCode(dialog.promoCode.id);
      setToast({
        message: `${dialog.promoCode.code} was deleted.`,
        title: "Promo deleted",
        tone: "success",
      });
      setDialog(null);
    } catch (requestError: unknown) {
      setToast({
        message: getErrorMessage(requestError),
        title: "Promo delete failed",
        tone: "error",
      });
      setDialog(null);
    }
  };

  return (
    <section
      aria-label="Promo code management"
      className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-medium text-txt-primary">
            Promo Codes
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Review discounts, usage limits, activation state, and redemption
            windows.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/promos/create"
        >
          <Plus aria-hidden="true" size={18} />
          Create promo code
        </Link>
      </header>

      <div className="grid gap-3 border-b border-background-secondary px-5 py-5 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.25fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(160px,0.6fr)]">
        <SearchField
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          value={search}
        />
        <FilterSelect
          label="Status"
          onChange={(value) => {
            setStatus(value as PromoCodeStatus | "");
            resetToFirstPage();
          }}
          options={[
            ["", "All statuses"],
            ...promoStatuses.map((item) => [item, label(item)] as const),
          ]}
          value={status}
        />
        <FilterSelect
          label="Discount type"
          onChange={(value) => {
            setDiscountType(value as PromoDiscountType | "");
            resetToFirstPage();
          }}
          options={[
            ["", "All discount types"],
            ...promoDiscountTypes.map((item) => [item, label(item)] as const),
          ]}
          value={discountType}
        />
        <FilterSelect
          label="Target type"
          onChange={(value) => {
            setTargetType(value as PromoTargetType | "");
            resetToFirstPage();
          }}
          options={[
            ["", "All target types"],
            ...promoTargetTypes.map((item) => [item, label(item)] as const),
          ]}
          value={targetType}
        />
        <FilterSelect
          label="Payment method"
          onChange={(value) => {
            setPaymentMethod(value as PromoPaymentMethod | "");
            resetToFirstPage();
          }}
          options={[
            ["", "All payment methods"],
            ...promoPaymentMethods.map((item) => [item, label(item)] as const),
          ]}
          value={paymentMethod}
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
        <LoadingState className="p-6" label="Loading promo codes" />
      ) : error ? (
        <RetryState
          error={error}
          onRetry={() => void loadPromoCodes().catch(() => undefined)}
        />
      ) : (
        <>
          <DataTable
            columnHeaderClassName="bg-card-bg-secondary px-4 py-3.5 text-sm font-semibold tracking-wider text-txt-primary"
            columns={[
              {
                className: "w-[110px] text-center",
                heading: "Active",
                key: "active",
              },
              { heading: "Code", key: "code" },
              { heading: "Amount", key: "amount" },
              { heading: "Type", key: "type" },
              { heading: "Max Discount", key: "max-discount" },
              { heading: "Created At", key: "created-at" },
              {
                className: "w-[130px] text-center",
                heading: "Status",
                key: "status",
              },
              { heading: "Minimum Order Price", key: "minimum-order" },
              { heading: "Usage", key: "usage" },
              { heading: "Maximum Usage", key: "maximum-usage" },
              {
                className: "w-[150px] text-center",
                heading: "Action",
                key: "action",
              },
            ]}
            emptyMessage="No promo codes found."
            headerRowClassName="bg-card-bg-secondary text-txt-primary border-b border-background-secondary divide-x divide-background-secondary"
            isEmpty={promoCodes.length === 0}
            minWidthClassName="min-w-[1280px]"
            wrapperClassName="overflow-x-auto px-5"
          >
            {promoCodes.map((promoCode) => (
              <PromoCodeRow
                isMutating={isMutating}
                key={promoCode.id}
                onDelete={() => setDialog({ promoCode, type: "delete" })}
                onEdit={() => setDialog({ promoCode, type: "edit" })}
                onToggleStatus={() => void togglePromoCode(promoCode)}
                onView={() => router.push(`/promos/${promoCode.id}`)}
                promoCode={promoCode}
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

      {dialog?.type === "edit" ? (
        <PromoEditDialog
          isSaving={isMutating}
          onClose={() => setDialog(null)}
          onSubmit={(event) => void submitUpdate(event, dialog.promoCode)}
          promoCode={dialog.promoCode}
        />
      ) : null}

      {dialog?.type === "delete" ? (
        <section
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
        >
          <ConfirmationCard
            confirmLabel="Yes, delete"
            description={`Soft-delete promo code ${dialog.promoCode.code}? Redemption history remains available for audit and receipts.`}
            loading={isMutating}
            onCancel={() => setDialog(null)}
            onConfirm={() => void confirmDelete()}
            title="Delete promo code?"
            tone="danger"
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
    </section>
  );
}

function PromoEditDialog({
  isSaving,
  onClose,
  onSubmit,
  promoCode,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  promoCode: PromoCode;
}) {
  return (
    <section
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
    >
      <form
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md bg-card-bg-primary text-txt-primary shadow-xl"
        onSubmit={onSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase text-txt-secondary">
              Update Promo
            </p>
            <h3 className="mt-1 text-2xl font-semibold">{promoCode.code}</h3>
          </div>
          <div className="flex gap-3">
            <Button disabled={isSaving} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button loading={isSaving} type="submit">
              Save
            </Button>
          </div>
        </header>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Description
            </span>
            <input
              className={fieldClass}
              defaultValue={promoCode.description ?? ""}
              name="description"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Status
            </span>
            <select className={fieldClass} defaultValue={promoCode.status} name="status">
              {promoStatuses.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Discount type
            </span>
            <select
              className={fieldClass}
              defaultValue={promoCode.discount_type}
              name="discount_type"
            >
              {promoDiscountTypes.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            defaultValue={promoCode.discount_value}
            label="Discount value"
            name="discount_value"
            required
          />
          <NumberField
            defaultValue={promoCode.max_discount_amount}
            label="Maximum discount"
            name="max_discount_amount"
          />
          <NumberField
            defaultValue={promoCode.minimum_order_amount}
            label="Minimum order price"
            name="minimum_order_amount"
            required
          />
          <NumberField
            defaultValue={promoCode.max_redemptions}
            label="Maximum usage"
            name="max_redemptions"
          />
          <NumberField
            defaultValue={promoCode.per_user_limit}
            label="Per user limit"
            name="per_user_limit"
          />
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Target type
            </span>
            <select
              className={fieldClass}
              defaultValue={promoCode.allowed_target_types[0] ?? "booking"}
              name="target_type"
            >
              {promoTargetTypes.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Payment method
            </span>
            <select
              className={fieldClass}
              defaultValue={promoCode.allowed_payment_methods[0] ?? "knet"}
              name="payment_method"
            >
              {promoPaymentMethods.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <DateTimeField
            defaultValue={promoCode.starts_at}
            label="Starts at"
            name="starts_at"
          />
          <DateTimeField
            defaultValue={promoCode.ends_at}
            label="Ends at"
            name="ends_at"
          />
          <label className="flex items-center gap-3 rounded-sm border border-background-secondary bg-card-bg-secondary px-4 py-3">
            <input
              className="size-4 accent-primary"
              defaultChecked={promoCode.first_time_customer_only}
              name="first_time_customer_only"
              type="checkbox"
            />
            <span className="text-sm font-semibold">
              First-time customer only
            </span>
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs font-bold uppercase text-txt-secondary">
              Admin notes
            </span>
            <textarea
              className={`${fieldClass} min-h-28 py-3`}
              defaultValue={promoCode.admin_notes ?? ""}
              name="admin_notes"
            />
          </label>
        </div>
      </form>
    </section>
  );
}

function NumberField({
  defaultValue,
  label: fieldLabel,
  name,
  required = false,
}: {
  defaultValue: number | null;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <input
        className={fieldClass}
        defaultValue={defaultValue ?? ""}
        min="0"
        name={name}
        required={required}
        step="0.001"
        type="number"
      />
    </label>
  );
}

function DateTimeField({
  defaultValue,
  label: fieldLabel,
  name,
}: {
  defaultValue: string | null;
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <input
        className={fieldClass}
        defaultValue={toDateTimeInputValue(defaultValue)}
        name={name}
        type="datetime-local"
      />
    </label>
  );
}
