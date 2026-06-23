import { UserPrivateBookingDetailScreen } from "@/modules/bookings";

export default async function UserPrivateBookingDetailPage({
  params,
}: {
  params: Promise<{ privateBookingId: string }>;
}) {
  const { privateBookingId } = await params;

  return <UserPrivateBookingDetailScreen privateBookingId={privateBookingId} />;
}
