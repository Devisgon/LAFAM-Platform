import { adminBookingsClient } from "@/modules/bookings";
export const calendarApi = {
  createPrivateTrainerBooking: adminBookingsClient.createPrivateTrainer,
  list: adminBookingsClient.calendar,
};
