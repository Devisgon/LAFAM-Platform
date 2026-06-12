// apps/api/src/modules/bookings/bookings.module.ts
/**
 * LAFAM Bookings module.
 *
 * Role:
 * - Registers Booking Module controllers, services, and repository.
 * - Provides the backend boundary for Pilates booking lifecycle operations.
 * - Owns booking, cancellation, rescheduling, waitlist, availability, and booking-domain event application wiring.
 *
 * Important:
 * - Phase 1 Booking Module is Pilates-only.
 * - Salon booking must remain separate for Phase 2.
 * - Booking availability must come from database RPC functions, not TypeScript seat-count logic.
 * - Booking concurrency is handled by PostgreSQL atomic functions.
 * - Payment gateway settlement is not implemented here.
 * - WebSocket/SSE is not implemented here; BookingEventService only keeps events ready for future publishing.
 * - AuthModule is imported for guards/session enforcement used by Booking controllers.
 * - DatabaseModule provides the Supabase admin client used by BookingRepository.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { BookingAdminService } from './application/booking-admin.service';
import { BookingAvailabilityService } from './application/booking-availability.service';
import { BookingCustomerService } from './application/booking-customer.service';
import { BookingEventService } from './application/booking-event.service';
import { BookingAdminController } from './controllers/booking-admin.controller';
import { BookingCustomerController } from './controllers/booking-customer.controller';
import { BookingRepository } from './repositories/booking.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BookingCustomerController, BookingAdminController],
  providers: [
    BookingCustomerService,
    BookingAdminService,
    BookingAvailabilityService,
    BookingEventService,
    BookingRepository,
  ],
  exports: [
    BookingCustomerService,
    BookingAdminService,
    BookingAvailabilityService,
    BookingEventService,
    BookingRepository,
  ],
})
export class BookingsModule {}
