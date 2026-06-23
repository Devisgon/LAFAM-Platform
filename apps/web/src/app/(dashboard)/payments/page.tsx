import { AdminPaymentManager, UserPayments } from "@/modules/payments";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
import type {
  CustomerPaymentFilters,
  CustomerPaymentSortField,
  PaymentSortDirection,
  PaymentStatus,
  PaymentTargetType,
} from "@/modules/payments";

type SearchParams = Record<string, string | string[] | undefined>;

const PAYMENT_TARGET_TYPES: PaymentTargetType[] = [
  "booking",
  "private_booking",
  "wallet_top_up",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "requires_redirect",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refund_requested",
  "refund_processing",
  "manual_refund_required",
  "refunded",
];

const PAYMENT_SORT_FIELDS: CustomerPaymentSortField[] = [
  "created_at",
  "updated_at",
  "final_amount",
  "paid_at",
];

const PAYMENT_SORT_DIRECTIONS: PaymentSortDirection[] = ["asc", "desc"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveFilters(searchParams: SearchParams): CustomerPaymentFilters {
  const limit = Number(firstParam(searchParams.limit));
  const offset = Number(firstParam(searchParams.offset));
  const targetType = firstParam(searchParams.target_type);
  const status = firstParam(searchParams.status);
  const sortBy = firstParam(searchParams.sort_by);
  const sortDirection = firstParam(searchParams.sort_direction);

  return {
    from_date: firstParam(searchParams.from_date),
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
    sort_by: PAYMENT_SORT_FIELDS.includes(sortBy as CustomerPaymentSortField)
      ? (sortBy as CustomerPaymentSortField)
      : "created_at",
    sort_direction: PAYMENT_SORT_DIRECTIONS.includes(sortDirection as PaymentSortDirection)
      ? (sortDirection as PaymentSortDirection)
      : "desc",
    status: PAYMENT_STATUSES.includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : undefined,
    target_type: PAYMENT_TARGET_TYPES.includes(targetType as PaymentTargetType)
      ? (targetType as PaymentTargetType)
      : undefined,
    to_date: firstParam(searchParams.to_date),
  };
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <AdminPaymentManager />;

  return <UserPayments filters={resolveFilters(await searchParams)} />;
}
