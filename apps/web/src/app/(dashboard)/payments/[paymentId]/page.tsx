import { UserPaymentDetailScreen } from "@/modules/payments";

export default async function UserPaymentDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  return <UserPaymentDetailScreen paymentId={paymentId} />;
}
