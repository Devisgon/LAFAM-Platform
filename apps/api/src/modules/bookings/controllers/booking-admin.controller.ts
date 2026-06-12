// apps/api/src/modules/bookings/controllers/booking-admin.controller.ts
/**
 * LAFAM admin booking controller.
 *
 * Role:
 * - Exposes protected admin Booking Module endpoints.
 * - Allows admins to list and read all customer bookings.
 * - Allows admins to cancel and reschedule bookings.
 * - Allows admins to perform controlled booking status overrides.
 * - Allows admins to inspect schedule waitlists.
 * - Allows admins to remove waitlist entries.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts these endpoints to admin and super-admin users.
 * - Controllers must stay thin.
 * - Controllers must not calculate booking capacity.
 * - Controllers must not perform direct database writes.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
} from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { BookingAdminService } from '../application/booking-admin.service';
import {
  BOOKING_ADMIN_ROUTE_PREFIX,
  BOOKING_ADMIN_SCHEDULE_WAITLIST_ROUTE_PREFIX,
  BOOKING_ADMIN_WAITLIST_ROUTE_PREFIX,
} from '../constants/booking.constants';
import {
  BookingParamDto,
  BookingScheduleParamDto,
  BookingWaitlistParamDto,
} from '../dto/booking-param.dto';
import { AdminCancelBookingDto } from '../dto/admin-cancel-booking.dto';
import { AdminOverrideBookingDto } from '../dto/admin-override-booking.dto';
import { ListAdminBookingsQueryDto } from '../dto/list-admin-bookings-query.dto';
import { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type {
  BookingCancelResult,
  BookingDetail,
  BookingListResult,
  BookingRescheduleResult,
  BookingWaitlistListItem,
  BookingWaitlistListResult,
} from '../types/booking.types';

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAuthenticatedAdminId(
  auth: AuthInternalContext | undefined,
): string {
  return resolveAuthContext(auth).profile.id;
}

@Controller()
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class BookingAdminController {
  constructor(private readonly bookingAdminService: BookingAdminService) {}

  @Get(BOOKING_ADMIN_ROUTE_PREFIX)
  async listBookings(
    @Query() query: ListAdminBookingsQueryDto,
  ): Promise<ApiSuccessResponse<BookingListResult>> {
    const data = await this.bookingAdminService.listBookings(query);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Bookings retrieved successfully.',
      data,
    });
  }

  @Get(`${BOOKING_ADMIN_SCHEDULE_WAITLIST_ROUTE_PREFIX}/:scheduleId/waitlist`)
  async listScheduleWaitlist(
    @Param() params: BookingScheduleParamDto,
  ): Promise<ApiSuccessResponse<BookingWaitlistListResult>> {
    const data = await this.bookingAdminService.listScheduleWaitlist(
      params.scheduleId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Schedule waitlist entries retrieved successfully.',
      data,
    });
  }

  @Delete(`${BOOKING_ADMIN_WAITLIST_ROUTE_PREFIX}/:waitlistId`)
  @HttpCode(HttpStatus.OK)
  async removeWaitlistEntry(
    @Param() params: BookingWaitlistParamDto,
  ): Promise<ApiSuccessResponse<BookingWaitlistListItem>> {
    const data = await this.bookingAdminService.removeWaitlistEntry(
      params.waitlistId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Waitlist entry removed successfully.',
      data,
    });
  }

  @Get(`${BOOKING_ADMIN_ROUTE_PREFIX}/:bookingId`)
  async getBookingById(
    @Param() params: BookingParamDto,
  ): Promise<ApiSuccessResponse<BookingDetail>> {
    const data = await this.bookingAdminService.getBookingById(
      params.bookingId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking retrieved successfully.',
      data,
    });
  }

  @Post(`${BOOKING_ADMIN_ROUTE_PREFIX}/:bookingId/cancel`)
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
    @Body() body: AdminCancelBookingDto,
  ): Promise<ApiSuccessResponse<BookingCancelResult>> {
    const data = await this.bookingAdminService.cancelBooking(
      resolveAuthenticatedAdminId(auth),
      params.bookingId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking cancelled successfully.',
      data,
    });
  }

  @Post(`${BOOKING_ADMIN_ROUTE_PREFIX}/:bookingId/reschedule`)
  @HttpCode(HttpStatus.OK)
  async rescheduleBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
    @Body() body: RescheduleBookingDto,
  ): Promise<ApiSuccessResponse<BookingRescheduleResult>> {
    const data = await this.bookingAdminService.rescheduleBooking(
      resolveAuthenticatedAdminId(auth),
      params.bookingId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking reschedule request processed successfully.',
      data,
    });
  }

  @Post(`${BOOKING_ADMIN_ROUTE_PREFIX}/:bookingId/override`)
  @HttpCode(HttpStatus.OK)
  async overrideBookingStatus(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
    @Body() body: AdminOverrideBookingDto,
  ): Promise<ApiSuccessResponse<BookingDetail>> {
    const data = await this.bookingAdminService.overrideBookingStatus(
      resolveAuthenticatedAdminId(auth),
      params.bookingId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking override applied successfully.',
      data,
    });
  }
}
