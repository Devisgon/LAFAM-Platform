// apps/api/src/modules/bookings/dto/booking-param.dto.ts
/**
 * LAFAM Booking param DTOs.
 *
 * Role:
 * - Validates Booking Module route parameters.
 * - Keeps route-param validation explicit and controller-safe.
 * - Provides separate DTOs for booking, waitlist, and Pilates schedule params.
 *
 * Important:
 * - These DTOs validate only route parameter shape.
 * - These DTOs do not check whether the booking, waitlist entry, or schedule exists.
 * - These DTOs do not decide authorization.
 * - Service classes must verify ownership, existence, status, and role permissions.
 * - Auth guards and role guards must enforce access control before service mutation.
 */

import { IsUUID } from 'class-validator';

export class BookingParamDto {
  @IsUUID('4', {
    message: 'bookingId must be a valid UUID.',
  })
  readonly bookingId!: string;
}

export class BookingWaitlistParamDto {
  @IsUUID('4', {
    message: 'waitlistId must be a valid UUID.',
  })
  readonly waitlistId!: string;
}

export class BookingScheduleParamDto {
  @IsUUID('4', {
    message: 'scheduleId must be a valid UUID.',
  })
  readonly scheduleId!: string;
}
