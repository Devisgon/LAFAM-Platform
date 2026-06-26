// apps/api/src/modules/bookings/controllers/booking-admin.controller.ts
/**
 * LAFAM admin/staff/trainer booking controller.
 *
 * Role:
 * - Exposes protected admin Booking Module endpoints.
 * - Allows admins and staff to list and read all customer bookings.
 * - Allows admins, staff, and scoped trainers to manage Pilates bookings.
 * - Allows admins, staff, and scoped trainers to create backend-owned bulk booking orders.
 * - Allows admins, staff, and scoped trainers to read booking orders.
 * - Allows admins and staff to manage private trainer bookings.
 * - Allows admins and staff to access the full admin booking calendar.
 * - Allows admins, staff, and scoped trainers to inspect schedule waitlists.
 * - Allows admins, staff, and scoped trainers to remove waitlist entries.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard allows admin, super-admin, staff, and trainer access where appropriate.
 * - Controller role checks are not enough for trainer-scoped access.
 * - BookingAdminService must receive the authenticated actor context.
 * - BookingAdminService enforces trainer ownership for scoped booking management.
 * - Controllers must stay thin.
 * - Controllers must not calculate booking capacity.
 * - Controllers must not calculate booking-order totals.
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
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import {
  BookingAdminService,
  type BookingAdminActorContext,
} from '../application/booking-admin.service';
import { BookingCalendarService } from '../application/booking-calendar.service';
import { PrivateBookingAvailabilityService } from '../application/private-booking-availability.service';
import {
  BOOKING_ADMIN_AND_STAFF_ACCESS_ROLES,
  BOOKING_ADMIN_BULK_ROUTE_PREFIX,
  BOOKING_ADMIN_CALENDAR_ROUTE_PREFIX,
  BOOKING_ADMIN_ORDER_ROUTE_PREFIX,
  BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX,
  BOOKING_ADMIN_ROUTE_PREFIX,
  BOOKING_ADMIN_SCHEDULE_WAITLIST_ROUTE_PREFIX,
  BOOKING_ADMIN_WAITLIST_ROUTE_PREFIX,
  BOOKING_FULL_MANAGEMENT_ROLES,
  BOOKING_ORDER_ID_PARAM_NAME,
  PRIVATE_BOOKING_ID_PARAM_NAME,
  PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME,
} from '../constants/booking.constants';
import { AdminCancelBookingDto } from '../dto/admin-cancel-booking.dto';
import { AdminOverrideBookingDto } from '../dto/admin-override-booking.dto';
import {
  BookingParamDto,
  BookingScheduleParamDto,
  BookingWaitlistParamDto,
} from '../dto/booking-param.dto';
import { CreateAdminBulkBookingDto } from '../dto/create-admin-bulk-booking.dto';
import { CreateAdminPrivateBookingDto } from '../dto/create-admin-private-booking.dto';
import { ListAdminBookingsQueryDto } from '../dto/list-admin-bookings-query.dto';
import { ListAdminCalendarQueryDto } from '../dto/list-admin-calendar-query.dto';
import { ListAdminPrivateBookingsQueryDto } from '../dto/list-private-bookings-query.dto';
import {
  PrivateBookingParamDto,
  PrivateBookingTrainerParamDto,
} from '../dto/private-booking-param.dto';
import { PrivateSlotAvailabilityQueryDto } from '../dto/private-slot-availability-query.dto';
import { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import { ReschedulePrivateBookingDto } from '../dto/reschedule-private-booking.dto';
import type {
  BookingBulkCreateResult,
  BookingCalendarResult,
  BookingCancelResult,
  BookingDetail,
  BookingListResult,
  BookingOrderDetail,
  BookingRescheduleResult,
  BookingWaitlistListItem,
  BookingWaitlistListResult,
  PrivateBookingAvailabilitySlot,
  PrivateBookingCancelResult,
  PrivateBookingCreateResult,
  PrivateBookingDetail,
  PrivateBookingListResult,
  PrivateBookingRescheduleResult,
} from '../types/booking.types';

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAuthenticatedActorContext(
  auth: AuthInternalContext | undefined,
): BookingAdminActorContext {
  const context = resolveAuthContext(auth);

  return {
    user_id: context.profile.id,
    role: context.profile.role,
  };
}

@Controller()
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(...BOOKING_ADMIN_AND_STAFF_ACCESS_ROLES)
export class BookingAdminController {
  constructor(
    private readonly bookingAdminService: BookingAdminService,
    private readonly bookingCalendarService: BookingCalendarService,
    private readonly privateBookingAvailabilityService: PrivateBookingAvailabilityService,
  ) {}

  @Get(BOOKING_ADMIN_ROUTE_PREFIX)
  async listBookings(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListAdminBookingsQueryDto,
  ): Promise<ApiSuccessResponse<BookingListResult>> {
    const data = await this.bookingAdminService.listBookings(
      query,
      resolveAuthenticatedActorContext(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Bookings retrieved successfully.',
      data,
    });
  }

  @Post(BOOKING_ADMIN_BULK_ROUTE_PREFIX)
  @HttpCode(HttpStatus.CREATED)
  async createBulkBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateAdminBulkBookingDto,
  ): Promise<ApiSuccessResponse<BookingBulkCreateResult>> {
    const data = await this.bookingAdminService.createBulkBooking(
      resolveAuthenticatedActorContext(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Bulk booking order created successfully.',
      data,
    });
  }

  @Get(`${BOOKING_ADMIN_SCHEDULE_WAITLIST_ROUTE_PREFIX}/:scheduleId/waitlist`)
  async listScheduleWaitlist(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingScheduleParamDto,
  ): Promise<ApiSuccessResponse<BookingWaitlistListResult>> {
    const data = await this.bookingAdminService.listScheduleWaitlist(
      params.scheduleId,
      undefined,
      undefined,
      undefined,
      resolveAuthenticatedActorContext(auth),
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
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingWaitlistParamDto,
  ): Promise<ApiSuccessResponse<BookingWaitlistListItem>> {
    const data = await this.bookingAdminService.removeWaitlistEntry(
      params.waitlistId,
      null,
      resolveAuthenticatedActorContext(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Waitlist entry removed successfully.',
      data,
    });
  }

  @Get(BOOKING_ADMIN_CALENDAR_ROUTE_PREFIX)
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  async listAdminCalendar(
    @Query() query: ListAdminCalendarQueryDto,
  ): Promise<ApiSuccessResponse<BookingCalendarResult>> {
    const data = await this.bookingCalendarService.listAdminCalendar(query);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking calendar retrieved successfully.',
      data,
    });
  }

  @Post(BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX)
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async createPrivateBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateAdminPrivateBookingDto,
  ): Promise<ApiSuccessResponse<PrivateBookingCreateResult>> {
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.createPrivateBooking(
      actor.user_id,
      body,
      actor,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Private trainer booking request processed successfully.',
      data,
    });
  }

  @Get(BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX)
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  async listPrivateBookings(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListAdminPrivateBookingsQueryDto,
  ): Promise<ApiSuccessResponse<PrivateBookingListResult>> {
    const data = await this.bookingAdminService.listPrivateBookings(
      query,
      resolveAuthenticatedActorContext(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Private trainer bookings retrieved successfully.',
      data,
    });
  }

  @Get(
    `${BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX}/availability/:${PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME}`,
  )
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  async checkPrivateTrainerAvailability(
    @Param() params: PrivateBookingTrainerParamDto,
    @Query() query: PrivateSlotAvailabilityQueryDto,
  ): Promise<ApiSuccessResponse<PrivateBookingAvailabilitySlot>> {
    const data = await this.privateBookingAvailabilityService.checkTrainerSlot(
      params[PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME],
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Private trainer slot availability checked successfully.',
      data,
    });
  }

  @Get(
    `${BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX}/:${PRIVATE_BOOKING_ID_PARAM_NAME}`,
  )
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  async getPrivateBookingById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PrivateBookingParamDto,
  ): Promise<ApiSuccessResponse<PrivateBookingDetail>> {
    const data = await this.bookingAdminService.getPrivateBookingById(
      params[PRIVATE_BOOKING_ID_PARAM_NAME],
      resolveAuthenticatedActorContext(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Private trainer booking retrieved successfully.',
      data,
    });
  }

  @Post(
    `${BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX}/:${PRIVATE_BOOKING_ID_PARAM_NAME}/cancel`,
  )
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  @HttpCode(HttpStatus.OK)
  async cancelPrivateBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PrivateBookingParamDto,
    @Body() body: AdminCancelBookingDto,
  ): Promise<ApiSuccessResponse<PrivateBookingCancelResult>> {
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.cancelPrivateBooking(
      actor.user_id,
      params[PRIVATE_BOOKING_ID_PARAM_NAME],
      body,
      actor,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Private trainer booking cancelled successfully.',
      data,
    });
  }

  @Post(
    `${BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX}/:${PRIVATE_BOOKING_ID_PARAM_NAME}/reschedule`,
  )
  @Roles(...BOOKING_FULL_MANAGEMENT_ROLES)
  @HttpCode(HttpStatus.OK)
  async reschedulePrivateBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PrivateBookingParamDto,
    @Body() body: ReschedulePrivateBookingDto,
  ): Promise<ApiSuccessResponse<PrivateBookingRescheduleResult>> {
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.reschedulePrivateBooking(
      actor.user_id,
      params[PRIVATE_BOOKING_ID_PARAM_NAME],
      body,
      actor,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message:
        'Private trainer booking reschedule request processed successfully.',
      data,
    });
  }

  @Get(`${BOOKING_ADMIN_ORDER_ROUTE_PREFIX}/:${BOOKING_ORDER_ID_PARAM_NAME}`)
  async getBookingOrderById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param(BOOKING_ORDER_ID_PARAM_NAME) bookingOrderId: string,
  ): Promise<ApiSuccessResponse<BookingOrderDetail>> {
    const data = await this.bookingAdminService.getBookingOrderById(
      bookingOrderId,
      resolveAuthenticatedActorContext(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking order retrieved successfully.',
      data,
    });
  }

  @Get(`${BOOKING_ADMIN_ROUTE_PREFIX}/:bookingId`)
  async getBookingById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
  ): Promise<ApiSuccessResponse<BookingDetail>> {
    const data = await this.bookingAdminService.getBookingById(
      params.bookingId,
      resolveAuthenticatedActorContext(auth),
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
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.cancelBooking(
      actor.user_id,
      params.bookingId,
      body,
      actor,
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
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.rescheduleBooking(
      actor.user_id,
      params.bookingId,
      body,
      actor,
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
    const actor = resolveAuthenticatedActorContext(auth);
    const data = await this.bookingAdminService.overrideBookingStatus(
      actor.user_id,
      params.bookingId,
      body,
      actor,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking override applied successfully.',
      data,
    });
  }
}
