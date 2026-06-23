import { UserBookingDetailScreen } from "@/modules/bookings";

export default async function UserBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  return <UserBookingDetailScreen bookingId={bookingId} />;
}
