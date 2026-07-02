"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import {
  adminPromoCodesClient,
  type CreatePromoCodePayload,
  type PromoDiscountType,
  type PromoPaymentMethod,
  type PromoTargetType,
} from "../../api/promoCodesApi";
import {
  fieldClass,
  promoPaymentMethods,
  promoTargetTypes,
} from "../../constants/promoUi.constants";
import type { ResultToast } from "../../types/promoUi.types";
import { label } from "../../utils/promoFormatters";

type CreateStatus = "draft" | "active";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Promo code was not created.";
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

function numberOrZero(value: FormDataEntryValue | null): number {
  return numberOrNull(value) ?? 0;
}

function getCheckedValues<TValue extends string>(
  formData: FormData,
  key: string,
): TValue[] {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean) as TValue[];
}

function buildCreatePayload(
  formData: FormData,
  discountType: PromoDiscountType,
): CreatePromoCodePayload {
  return {
    admin_notes: String(formData.get("admin_notes") ?? "").trim() || null,
    allowed_payment_methods: getCheckedValues<PromoPaymentMethod>(
      formData,
      "allowed_payment_methods",
    ),
    allowed_target_types: getCheckedValues<PromoTargetType>(
      formData,
      "allowed_target_types",
    ),
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    currency: "KWD",
    description: String(formData.get("description") ?? "").trim() || null,
    discount_type: discountType,
    discount_value: numberOrZero(formData.get("discount_value")),
    ends_at: toIsoOrNull(formData.get("ends_at")),
    first_time_customer_only:
      formData.get("first_time_customer_only") === "on",
    max_discount_amount:
      discountType === "percentage"
        ? numberOrNull(formData.get("max_discount_amount"))
        : null,
    max_redemptions: numberOrNull(formData.get("max_redemptions")),
    metadata: {
      campaign: String(formData.get("campaign") ?? "").trim() || undefined,
    },
    minimum_order_amount: numberOrZero(formData.get("minimum_order_amount")),
    per_user_limit: numberOrNull(formData.get("per_user_limit")),
    starts_at: toIsoOrNull(formData.get("starts_at")),
    status: formData.get("status") as CreateStatus,
    target_ids: {
      class_ids: [],
      customer_user_ids: [],
      schedule_ids: [],
      trainer_staff_profile_ids: [],
    },
  };
}

export function PromoCodeCreatePage() {
  const router = useRouter();
  const [discountType, setDiscountType] =
    useState<PromoDiscountType>("percentage");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const submitPromoCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const createdPromoCode = await adminPromoCodesClient.create(
        buildCreatePayload(new FormData(event.currentTarget), discountType),
      );
      setToast({
        message: `${createdPromoCode.code} was created.`,
        title: "Promo code created",
        tone: "success",
      });
      router.push("/promos");
      router.refresh();
    } catch (requestError: unknown) {
      setToast({
        message: getErrorMessage(requestError),
        title: "Promo code not created",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <form
        className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
        onSubmit={submitPromoCode}
      >
        <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-medium text-txt-primary">
              Create Promo Code
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              Choose the discount type first, then complete the campaign rule.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-secondary px-4 py-2 font-semibold text-txt-primary transition hover:bg-background-secondary"
              href="/promos"
            >
              Cancel
            </Link>
            <Button loading={isSaving} type="submit">
              Create promo
            </Button>
          </div>
        </header>

        <div className="grid gap-6 px-5 py-5">
          <section className="grid gap-3">
            <h3 className="text-base font-semibold text-txt-primary">
              Promo Type
            </h3>
            <label className="max-w-md">
              <span className="sr-only">Promo discount type</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  setDiscountType(event.target.value as PromoDiscountType)
                }
                value={discountType}
              >
                <option value="percentage">Percentage promo</option>
                <option value="fixed_amount">Fixed amount promo</option>
              </select>
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField label="Code" name="code" placeholder="INTRO10" required />
            <TextField
              label="Description"
              name="description"
              placeholder="10% off first Pilates booking"
            />
            <SelectField
              label="Status"
              name="status"
              options={[
                ["draft", "Draft"],
                ["active", "Active"],
              ]}
            />
            <DateTimeField label="Starts at" name="starts_at" />
            <DateTimeField label="Ends at" name="ends_at" />
            <NumberField
              label="Minimum order price"
              name="minimum_order_amount"
              placeholder="0"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <NumberField
              label={
                discountType === "percentage"
                  ? "Discount percentage"
                  : "Fixed discount amount"
              }
              max={discountType === "percentage" ? 100 : undefined}
              name="discount_value"
              placeholder={discountType === "percentage" ? "10" : "5"}
              required
            />
            {discountType === "percentage" ? (
              <NumberField
                label="Maximum discount amount"
                name="max_discount_amount"
                placeholder="5"
              />
            ) : null}
            <NumberField
              label="Maximum usage"
              name="max_redemptions"
              placeholder="100"
            />
            <NumberField
              label="Per user limit"
              name="per_user_limit"
              placeholder="1"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <CheckboxGroup
              defaultValues={["booking"]}
              label="Allowed target types"
              name="allowed_target_types"
              options={promoTargetTypes.map((item) => [item, label(item)])}
            />
            <CheckboxGroup
              defaultValues={["knet", "card", "wallet"]}
              label="Allowed payment methods"
              name="allowed_payment_methods"
              options={promoPaymentMethods.map((item) => [item, label(item)])}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-sm border border-background-secondary bg-card-bg-secondary px-4 py-3">
              <input
                className="size-4 accent-primary"
                defaultChecked
                name="first_time_customer_only"
                type="checkbox"
              />
              <span className="text-sm font-semibold">
                First-time customer only
              </span>
            </label>
            <TextField
              label="Campaign metadata"
              name="campaign"
              placeholder="july_first_booking"
            />
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-bold uppercase text-txt-secondary">
                Admin notes
              </span>
              <textarea
                className={`${fieldClass} min-h-28 py-3`}
                name="admin_notes"
                placeholder="July acquisition campaign."
              />
            </label>
          </section>
        </div>
      </form>

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

function TextField({
  label: fieldLabel,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <input
        className={fieldClass}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function NumberField({
  label: fieldLabel,
  max,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  max?: number;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <input
        className={fieldClass}
        max={max}
        min="0"
        name={name}
        placeholder={placeholder}
        required={required}
        step="0.001"
        type="number"
      />
    </label>
  );
}

function DateTimeField({ label: fieldLabel, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <input className={fieldClass} name={name} type="datetime-local" />
    </label>
  );
}

function SelectField({
  label: fieldLabel,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase text-txt-secondary">
        {fieldLabel}
      </span>
      <select className={fieldClass} name={name}>
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  defaultValues,
  label: groupLabel,
  name,
  options,
}: {
  defaultValues: string[];
  label: string;
  name: string;
  options: Array<[string, string]>;
}) {
  return (
    <fieldset className="rounded-sm border border-background-secondary bg-card-bg-secondary px-4 py-3">
      <legend className="text-xs font-bold uppercase text-txt-secondary">
        {groupLabel}
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map(([value, optionLabel]) => (
          <label className="flex items-center gap-3 text-sm" key={value}>
            <input
              className="size-4 accent-primary"
              defaultChecked={defaultValues.includes(value)}
              name={name}
              type="checkbox"
              value={value}
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
