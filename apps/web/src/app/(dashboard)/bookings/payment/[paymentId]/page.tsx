import { CustomerPaymentVerification } from "@/modules/payments";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerPaymentVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { paymentId } = await params;
  const bookingId = firstParam((await searchParams).booking_id);

  return <CustomerPaymentVerification bookingId={bookingId} paymentId={paymentId} />;
}
