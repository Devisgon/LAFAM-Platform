// apps/api/src/modules/bookings/controllers/booking-customer.controller.ts
/**
 * LAFAM customer booking controller.
 *
 * Role:
 * - Exposes protected customer Booking Module endpoints.
 * - Allows authenticated customers to create Pilates bookings.
 * - Allows authenticated customers to list and read their own bookings.
 * - Allows authenticated customers to cancel and reschedule their own bookings.
 * - Allows authenticated customers to list and cancel their own waitlist entries.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - RolesGuard restricts these endpoints to customer users.
 * - Controllers must not trust user_id from request body or query params.
 * - BookingCustomerService must receive the authenticated app user id from Auth context.
 * - Controllers must stay thin and delegate business logic to services.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Body,
  Controller,
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
import { AUTH_CUSTOMER_ROLE } from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { BookingCustomerService } from '../application/booking-customer.service';
import { BOOKING_CUSTOMER_ROUTE_PREFIX } from '../constants/booking.constants';
import {
  BookingParamDto,
  BookingWaitlistParamDto,
} from '../dto/booking-param.dto';
import { CancelBookingDto } from '../dto/cancel-booking.dto';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type {
  BookingCancelResult,
  BookingCreateResult,
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

function resolveAuthenticatedCustomerId(
  auth: AuthInternalContext | undefined,
): string {
  return resolveAuthContext(auth).profile.id;
}

@Controller(BOOKING_CUSTOMER_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_CUSTOMER_ROLE)
export class BookingCustomerController {
  constructor(
    private readonly bookingCustomerService: BookingCustomerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateBookingDto,
  ): Promise<ApiSuccessResponse<BookingCreateResult>> {
    const data = await this.bookingCustomerService.createBooking(
      resolveAuthenticatedCustomerId(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Booking request processed successfully.',
      data,
    });
  }

  @Get()
  async listBookings(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListBookingsQueryDto,
  ): Promise<ApiSuccessResponse<BookingListResult>> {
    const data = await this.bookingCustomerService.listBookings(
      resolveAuthenticatedCustomerId(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Bookings retrieved successfully.',
      data,
    });
  }

  @Get('waitlist')
  async listWaitlist(
    @CurrentAuth() auth: AuthInternalContext | undefined,
  ): Promise<ApiSuccessResponse<BookingWaitlistListResult>> {
    const data = await this.bookingCustomerService.listWaitlist(
      resolveAuthenticatedCustomerId(auth),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Waitlist entries retrieved successfully.',
      data,
    });
  }

  @Post('waitlist/:waitlistId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelWaitlistEntry(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingWaitlistParamDto,
    @Body() body: CancelBookingDto,
  ): Promise<ApiSuccessResponse<BookingWaitlistListItem>> {
    const data = await this.bookingCustomerService.cancelWaitlistEntry(
      resolveAuthenticatedCustomerId(auth),
      params.waitlistId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Waitlist entry cancelled successfully.',
      data,
    });
  }

  @Get(':bookingId')
  async getBookingById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
  ): Promise<ApiSuccessResponse<BookingDetail>> {
    const data = await this.bookingCustomerService.getBookingById(
      resolveAuthenticatedCustomerId(auth),
      params.bookingId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking retrieved successfully.',
      data,
    });
  }

  @Post(':bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
    @Body() body: CancelBookingDto,
  ): Promise<ApiSuccessResponse<BookingCancelResult>> {
    const data = await this.bookingCustomerService.cancelBooking(
      resolveAuthenticatedCustomerId(auth),
      params.bookingId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking cancelled successfully.',
      data,
    });
  }

  @Post(':bookingId/reschedule')
  @HttpCode(HttpStatus.OK)
  async rescheduleBooking(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: BookingParamDto,
    @Body() body: RescheduleBookingDto,
  ): Promise<ApiSuccessResponse<BookingRescheduleResult>> {
    const data = await this.bookingCustomerService.rescheduleBooking(
      resolveAuthenticatedCustomerId(auth),
      params.bookingId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Booking reschedule request processed successfully.',
      data,
    });
  }
}
