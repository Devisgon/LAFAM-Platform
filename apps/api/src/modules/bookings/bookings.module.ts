// apps/api/src/modules/bookings/bookings.module.ts
/**
 * LAFAM Bookings module.
 *
 * Role:
 * - Registers Booking Module controllers, services, and repository.
 * - Provides the backend boundary for Pilates class bookings, bulk booking orders,
 *   private trainer bookings, booking calendar, waitlist, availability, and booking events.
 * - Wires StaffModule so BookingAdminService can resolve trainer staff profiles
 *   for scoped trainer booking management.
 * - Wires NotificationsModule so booking, waitlist, and private-booking email
 *   outbox records are created through the notification boundary.
 *
 * Important:
 * - Pilates class bookings and private trainer bookings are separate flows.
 * - Bulk Pilates booking creates booking orders and order items through BookingRepository RPCs.
 * - Private trainer bookings do not use pilates_class_schedules.
 * - Salon booking must remain separate for Phase 2.
 * - Booking availability must come from database RPC functions, not TypeScript seat-count logic.
 * - Booking concurrency is handled by PostgreSQL atomic functions.
 * - Booking-order creation, payment confirmation, and expiry are handled by PostgreSQL atomic functions.
 * - Private trainer booking conflict safety is handled by PostgreSQL atomic functions.
 * - StaffRepository is provided by StaffModule and is used only to resolve staff/trainer profile scope.
 * - Payment gateway settlement is not implemented here.
 * - WebSocket/SSE is not implemented here; BookingEventService only keeps events ready for future publishing.
 * - AuthModule is imported for guards/session enforcement used by Booking controllers.
 * - DatabaseModule provides the Supabase admin client used by BookingRepository.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffModule } from '../staff/staff.module';
import { BookingAdminService } from './application/booking-admin.service';
import { BookingAvailabilityService } from './application/booking-availability.service';
import { BookingCalendarService } from './application/booking-calendar.service';
import { BookingCustomerService } from './application/booking-customer.service';
import { BookingEventService } from './application/booking-event.service';
import { PrivateBookingAvailabilityService } from './application/private-booking-availability.service';
import { BookingAdminController } from './controllers/booking-admin.controller';
import { BookingCustomerController } from './controllers/booking-customer.controller';
import { BookingRepository } from './repositories/booking.repository';

@Module({
  imports: [DatabaseModule, AuthModule, StaffModule, NotificationsModule],
  controllers: [BookingCustomerController, BookingAdminController],
  providers: [
    BookingCustomerService,
    BookingAdminService,
    BookingAvailabilityService,
    PrivateBookingAvailabilityService,
    BookingCalendarService,
    BookingEventService,
    BookingRepository,
  ],
  exports: [
    BookingCustomerService,
    BookingAdminService,
    BookingAvailabilityService,
    PrivateBookingAvailabilityService,
    BookingCalendarService,
    BookingEventService,
    BookingRepository,
  ],
})
export class BookingsModule {}
