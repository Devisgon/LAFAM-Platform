"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  useCustomerCheckoutPayment,
  type CustomerCheckoutPaymentResult,
  type PaymentMethod,
} from "@/modules/payments";
import { useCreateUserBooking } from "../hooks/useUserBookings";
import type { PublicPilatesSchedule } from "@/modules/services/pilates";
import type { CreateUserBookingResult } from "../api/userBookingsApi";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  weekday: "long",
  year: "numeric",
});

function createIdempotencyKey(scheduleId: string): string {
  const randomId = Math.random().toString(36).slice(2, 10);
  const scheduleKey = scheduleId.replaceAll("-", "").slice(0, 12);

  return `customer-click-${scheduleKey}-${randomId}`;
}

function createCheckoutIdempotencyKey(
  bookingId: string | undefined,
  paymentMethod: PaymentMethod,
): string {
  const randomId = Math.random().toString(36).slice(2, 10);
  const bookingKey = bookingId?.replaceAll("-", "").slice(0, 12) ?? "pending";

  return `booking-checkout-${bookingKey}-${paymentMethod}-${randomId}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatPrice(schedule: PublicPilatesSchedule): string {
  const amount =
    schedule.price_amount ??
    schedule.class.default_price_amount ??
    0;
  const currency = schedule.currency ?? schedule.class.currency ?? "KWD";

  return `${amount.toFixed(3)} ${currency}`;
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function resultText(result: CreateUserBookingResult): string {
  if (result.result === "waitlisted") {
    return `You joined the waitlist at position ${result.waitlist?.position ?? 1}.`;
  }

  if (result.result === "existing_booking") {
    return "You already have a booking for this schedule.";
  }

  return `Booking confirmed${result.booking?.booking_number ? `: ${result.booking.booking_number}` : "."}`;
}

function safeRedirectUrl(value: string | null | undefined): string | null {
  if (!value?.trim() || value === "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function paymentStatusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid") return "success";
  if (status === "failed" || status === "cancelled" || status === "expired") return "error";
  if (status === "refunded") return "neutral";
  return "warning";
}

export function BookingCart({ schedule }: { schedule: PublicPilatesSchedule }) {
  const createBooking = useCreateUserBooking();
  const checkoutPayment = useCustomerCheckoutPayment();
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("knet");
  const [result, setResult] = useState<CreateUserBookingResult | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CustomerCheckoutPaymentResult | null>(null);
  const booking = result?.booking ?? null;
  const idempotencyKey = useMemo(() => createIdempotencyKey(schedule.id), [schedule.id]);
  const checkoutIdempotencyKey = useMemo(
    () => createCheckoutIdempotencyKey(booking?.id, paymentMethod),
    [booking?.id, paymentMethod],
  );
  const isUnavailable = schedule.status !== "scheduled";
  const paymentRedirectUrl = safeRedirectUrl(
    checkoutResult?.redirect_url ?? checkoutResult?.payment.redirect_url,
  );

  const confirmBooking = async () => {
    setError(null);
    setPaymentError(null);

    try {
      const created = await createBooking.mutateAsync({
        idempotency_key: idempotencyKey,
        payment_required: true,
        schedule_id: schedule.id,
      });
      setResult(created);
    } catch (requestError: unknown) {
      setError(getSafeErrorMessage(requestError));
    }
  };

  const checkoutBookingPayment = async () => {
    if (!booking) {
      setPaymentError("Please confirm the booking before starting payment.");
      return;
    }

    setPaymentError(null);

    try {
      const checkout = await checkoutPayment.mutateAsync({
        booking_id: booking.id,
        idempotency_key: checkoutIdempotencyKey,
        payment_method: paymentMethod,
        target_type: "booking",
      });
      setCheckoutResult(checkout);
    } catch (requestError: unknown) {
      setPaymentError(getSafeErrorMessage(requestError));
    }
  };

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Booking cart
            </p>
            <h1 className="mt-2 text-2xl font-bold">Confirm your class booking</h1>
            <p className="mt-2 text-sm leading-6 text-txt-secondary">
              Review the schedule details before confirming your Pilates booking.
            </p>
          </div>
          <Badge tone={schedule.availability.available_seats > 0 ? "success" : "warning"}>
            {schedule.availability.available_seats > 0
              ? `${schedule.availability.available_seats} seats left`
              : "Waitlist may apply"}
          </Badge>
        </div>
      </section>

      <section className="grid gap-5 rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] sm:p-6">
        <div className="grid gap-4">
          <div>
            <h2 className="text-xl font-bold">{schedule.class.title}</h2>
            <p className="mt-2 text-sm leading-7 text-txt-secondary">
              {schedule.class.description ?? "No description has been provided for this class."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CartDetail
              icon={<CalendarClock size={18} aria-hidden="true" />}
              label="Class time"
              value={`${formatDate(schedule.class_date)} | ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`}
            />
            <CartDetail
              icon={<MapPin size={18} aria-hidden="true" />}
              label="Studio"
              value={schedule.studio}
            />
            <CartDetail
              icon={<UserRound size={18} aria-hidden="true" />}
              label="Trainer"
              value={schedule.trainer.display_name}
            />
            <CartDetail
              icon={<CheckCircle2 size={18} aria-hidden="true" />}
              label="Class level"
              value={formatLabel(schedule.class.level)}
            />
          </div>
        </div>

        <aside className="rounded-xl border border-background-secondary bg-card-bg-secondary p-4">
          <h2 className="text-lg font-bold">Order summary</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <SummaryRow label="Price" value={formatPrice(schedule)} />
            <SummaryRow label="Duration" value={`${schedule.duration_minutes} minutes`} />
            <SummaryRow label="Capacity" value={`${schedule.capacity} people`} />
            <SummaryRow label="Payment required" value="Yes" />
          </dl>

          {error ? (
            <p className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3">
              <p className="text-sm font-semibold text-success" role="status">
                {resultText(result)}
              </p>
              {booking ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-4 py-2 text-sm font-bold text-txt-primary"
                    href={`/bookings/${encodeURIComponent(booking.id)}`}
                  >
                    View booking
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <Button
              className="mt-5"
              disabled={isUnavailable}
              fullWidth
              loading={createBooking.isPending}
              onClick={() => void confirmBooking()}
              size="lg"
            >
              Confirm booking
            </Button>
          )}

          {booking && !checkoutResult ? (
            <div className="mt-4 rounded-lg border border-background-secondary bg-card-bg-primary p-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Payment method
                <select
                  className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                  disabled={checkoutPayment.isPending}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  value={paymentMethod}
                >
                  <option value="knet">KNET</option>
                  <option value="card">Card</option>
                  <option value="wallet">Wallet</option>
                </select>
              </label>
              {paymentError ? (
                <p className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error" role="alert">
                  {paymentError}
                </p>
              ) : null}
              <Button
                className="mt-4"
                fullWidth
                loading={checkoutPayment.isPending}
                onClick={() => void checkoutBookingPayment()}
              >
                Pay for class
              </Button>
            </div>
          ) : null}

          {checkoutResult ? (
            <div className="mt-4 rounded-lg border border-background-secondary bg-card-bg-primary p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">Payment created</p>
                <Badge tone={paymentStatusTone(checkoutResult.payment.status)}>
                  {formatLabel(checkoutResult.payment.status)}
                </Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                <SummaryRow label="Payment number" value={checkoutResult.payment.payment_number} />
                <SummaryRow
                  label="Final amount"
                  value={`${checkoutResult.payment.final_amount.toFixed(3)} ${checkoutResult.payment.currency}`}
                />
                <SummaryRow label="Method" value={formatLabel(checkoutResult.payment.payment_method)} />
              </dl>
              {checkoutResult.wallet_account ? (
                <p className="mt-3 text-sm text-txt-secondary">
                  Wallet balance: {checkoutResult.wallet_account.available_balance.toFixed(3)}{" "}
                  {checkoutResult.wallet_account.currency}
                </p>
              ) : null}
              {checkoutResult.requires_redirect && !paymentRedirectUrl ? (
                <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  Checkout was created, but the payment redirect link is unavailable. Please verify
                  the payment or try another method.
                </p>
              ) : null}
              <div className="mt-4 grid gap-2">
                {paymentRedirectUrl ? (
                  <a
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-4 py-2 text-sm font-bold text-txt-primary"
                    href={paymentRedirectUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Continue payment
                  </a>
                ) : null}
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
                  href={`/bookings/payment/${encodeURIComponent(checkoutResult.payment.id)}?booking_id=${encodeURIComponent(booking?.id ?? "")}`}
                >
                  Verify payment
                </Link>
              </div>
            </div>
          ) : null}

          {isUnavailable ? (
            <p className="mt-3 text-sm text-warning">
              This schedule is not available for booking right now.
            </p>
          ) : null}

          <Link
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
            href={`/services/pilates/schedules/${encodeURIComponent(schedule.id)}`}
          >
            View schedule detail
          </Link>
        </aside>
      </section>
    </div>
  );
}

function CartDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">
          {label}
        </span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-background-secondary pb-3 last:border-b-0 last:pb-0">
      <dt className="text-txt-secondary">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
