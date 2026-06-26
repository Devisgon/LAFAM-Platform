// apps/api/src/modules/bookings/application/booking-event.service.ts
/**
 * LAFAM Booking event service.
 *
 * Role:
 * - Creates Booking domain-event records through the Booking repository.
 * - Converts stored Booking domain-event records into realtime-ready envelopes.
 * - Prepares payload contracts for future WebSocket/SSE publishing.
 * - Creates booking-order event records for bulk booking, payment, and expiry flows.
 *
 * Important:
 * - This service does not implement WebSocket/SSE.
 * - This service does not publish events to clients yet.
 * - This service does not mutate booking capacity or lifecycle state.
 * - Booking RPC functions already create core database-side events.
 * - Booking-order RPC functions remain the source of truth for order lifecycle state.
 * - Use this service for application-created events and future publisher flows.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  BOOKING_EVENT_AVAILABILITY_CHANGED,
  BOOKING_EVENT_BULK_BOOKING_CREATED,
  BOOKING_EVENT_CANCELLED,
  BOOKING_EVENT_CREATED,
  BOOKING_EVENT_EXPIRED,
  BOOKING_EVENT_ORDER_CREATED,
  BOOKING_EVENT_ORDER_EXPIRED,
  BOOKING_EVENT_ORDER_PAID,
  BOOKING_EVENT_RESCHEDULED,
  BOOKING_EVENT_WAITLIST_JOINED,
  BOOKING_EVENT_WAITLIST_PROMOTED,
  isBookingDomainEventName,
  type BookingDomainEventName,
} from '../constants/booking.constants';
import { BookingRepository } from '../repositories/booking.repository';
import type {
  BookingAvailabilityChangedPayload,
  BookingAvailabilitySnapshot,
  BookingBulkCreateResult,
  BookingCancelledEventPayload,
  BookingCreatedEventPayload,
  BookingDomainEventPayload,
  BookingDomainEventRecord,
  BookingExpiredEventPayload,
  BookingListItem,
  BookingOrderCreatedEventPayload,
  BookingOrderExpiredEventPayload,
  BookingOrderPaidEventPayload,
  BookingOrderSummary,
  BookingRealtimeEventEnvelope,
  BookingRescheduledEventPayload,
  BookingWaitlistJoinedEventPayload,
  BookingWaitlistListItem,
  BookingWaitlistPromotedEventPayload,
} from '../types/booking.types';

@Injectable()
export class BookingEventService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  createDomainEvent(
    input: BookingDomainEventPayload,
  ): Promise<BookingDomainEventRecord> {
    return this.bookingRepository.createDomainEvent(input);
  }

  createAvailabilityChangedEvent(
    availability: BookingAvailabilitySnapshot,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      schedule_id: availability.schedule_id,
      capacity: availability.capacity,
      booked_count: availability.booked_count,
      pending_hold_count: availability.pending_hold_count,
      available_seats: availability.available_seats,
      waitlist_count: availability.waitlist_count,
      waitlist_available: availability.waitlist_available,
      schedule_realtime_version: availability.schedule_realtime_version,
    } satisfies BookingAvailabilityChangedPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_AVAILABILITY_CHANGED,
      schedule_id: availability.schedule_id,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: null,
      payment_id: null,
      payload,
    });
  }

  createBookingCreatedEvent(
    booking: BookingListItem,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_id: booking.id,
      booking_number: booking.booking_number,
      user_id: booking.user_id,
      schedule_id: booking.schedule_id,
      class_id: booking.class_id,
      status: booking.status,
      payment_status: booking.payment_status,
      payment_required: booking.payment_required,
      seat_hold_expires_at: booking.seat_hold_expires_at,
    } satisfies BookingCreatedEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_CREATED,
      schedule_id: booking.schedule_id,
      booking_id: booking.id,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: booking.booking_order_id,
      payment_id: null,
      payload,
    });
  }

  createBookingCancelledEvent(
    booking: BookingListItem,
    reason: string | null,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_id: booking.id,
      user_id: booking.user_id,
      schedule_id: booking.schedule_id,
      class_id: booking.class_id,
      reason,
    } satisfies BookingCancelledEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_CANCELLED,
      schedule_id: booking.schedule_id,
      booking_id: booking.id,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: booking.booking_order_id,
      payment_id: null,
      payload,
    });
  }

  createBookingRescheduledEvent(
    oldBooking: BookingListItem,
    newBooking: BookingListItem,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      old_booking_id: oldBooking.id,
      new_booking_id: newBooking.id,
      old_schedule_id: oldBooking.schedule_id,
      new_schedule_id: newBooking.schedule_id,
      user_id: oldBooking.user_id,
    } satisfies BookingRescheduledEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_RESCHEDULED,
      schedule_id: newBooking.schedule_id,
      booking_id: newBooking.id,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: newBooking.booking_order_id,
      payment_id: null,
      payload,
    });
  }

  createBookingExpiredEvent(
    booking: BookingListItem,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_id: booking.id,
      user_id: booking.user_id,
      schedule_id: booking.schedule_id,
      class_id: booking.class_id,
    } satisfies BookingExpiredEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_EXPIRED,
      schedule_id: booking.schedule_id,
      booking_id: booking.id,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: booking.booking_order_id,
      payment_id: null,
      payload,
    });
  }

  createBookingOrderCreatedEvent(
    bookingOrder: BookingOrderSummary,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_order_id: bookingOrder.id,
      order_number: bookingOrder.order_number,
      customer_user_id: bookingOrder.customer_user_id,
      booking_count: bookingOrder.booking_count,
      total_amount: bookingOrder.total_amount,
      currency: bookingOrder.currency,
    } satisfies BookingOrderCreatedEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_ORDER_CREATED,
      schedule_id: null,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: bookingOrder.id,
      payment_id: null,
      payload,
    });
  }

  createBulkBookingCreatedEvent(
    result: BookingBulkCreateResult,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_order_id: result.booking_order.id,
      order_number: result.booking_order.order_number,
      customer_user_id: result.booking_order.customer_user_id,
      booking_count: result.booking_order.booking_count,
      total_amount: result.booking_order.total_amount,
      currency: result.booking_order.currency,
      item_count: result.items.length,
      booking_ids: result.items.map((item) => item.booking_id),
      schedule_ids: result.items.map((item) => item.schedule_id),
      checkout_required: result.checkout_required,
    } satisfies BookingOrderCreatedEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_BULK_BOOKING_CREATED,
      schedule_id: null,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: result.booking_order.id,
      payment_id: null,
      payload,
    });
  }

  createBookingOrderPaidEvent(
    bookingOrder: BookingOrderSummary,
    confirmedBookingCount: number,
    paymentId: string | null,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_order_id: bookingOrder.id,
      payment_id: paymentId,
      confirmed_booking_count: confirmedBookingCount,
    } satisfies BookingOrderPaidEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_ORDER_PAID,
      schedule_id: null,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: bookingOrder.id,
      payment_id: paymentId,
      payload,
    });
  }

  createBookingOrderExpiredEvent(
    bookingOrder: BookingOrderSummary,
    expiredBookingCount: number,
    paymentId: string | null,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      booking_order_id: bookingOrder.id,
      payment_id: paymentId,
      expired_booking_count: expiredBookingCount,
    } satisfies BookingOrderExpiredEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_ORDER_EXPIRED,
      schedule_id: null,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      booking_order_id: bookingOrder.id,
      payment_id: paymentId,
      payload,
    });
  }

  createWaitlistJoinedEvent(
    waitlist: BookingWaitlistListItem,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      waitlist_id: waitlist.id,
      user_id: waitlist.user_id,
      schedule_id: waitlist.schedule_id,
      class_id: waitlist.class_id,
      position: waitlist.position,
    } satisfies BookingWaitlistJoinedEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_WAITLIST_JOINED,
      schedule_id: waitlist.schedule_id,
      booking_id: null,
      waitlist_id: waitlist.id,
      private_booking_id: null,
      booking_order_id: null,
      payment_id: null,
      payload,
    });
  }

  createWaitlistPromotedEvent(
    waitlist: BookingWaitlistListItem,
    booking: BookingListItem,
  ): Promise<BookingDomainEventRecord> {
    const payload = {
      waitlist_id: waitlist.id,
      booking_id: booking.id,
      user_id: waitlist.user_id,
      schedule_id: waitlist.schedule_id,
      class_id: waitlist.class_id,
    } satisfies BookingWaitlistPromotedEventPayload & DatabaseJsonObject;

    return this.createEvent({
      event_type: BOOKING_EVENT_WAITLIST_PROMOTED,
      schedule_id: waitlist.schedule_id,
      booking_id: booking.id,
      waitlist_id: waitlist.id,
      private_booking_id: null,
      booking_order_id: booking.booking_order_id,
      payment_id: null,
      payload,
    });
  }

  listPendingDomainEvents(
    limit?: number,
  ): Promise<readonly BookingDomainEventRecord[]> {
    return this.bookingRepository.listPendingDomainEvents({ limit });
  }

  async listPendingRealtimeEventEnvelopes(
    limit?: number,
  ): Promise<readonly BookingRealtimeEventEnvelope[]> {
    const events = await this.listPendingDomainEvents(limit);

    return events.map((event) => this.toRealtimeEventEnvelope(event));
  }

  markDomainEventPublished(
    eventId: string,
    publishedAt = new Date().toISOString(),
  ): Promise<BookingDomainEventRecord> {
    return this.bookingRepository.markDomainEventPublished({
      event_id: eventId,
      published_at: publishedAt,
    });
  }

  toRealtimeEventEnvelope(
    event: BookingDomainEventRecord,
  ): BookingRealtimeEventEnvelope {
    return {
      event_type: this.resolveStoredEventType(event.event_type),
      schedule_id: event.schedule_id,
      booking_id: event.booking_id,
      waitlist_id: event.waitlist_id,
      private_booking_id: event.private_booking_id,
      booking_order_id: event.booking_order_id,
      payment_id: event.payment_id,
      payload: event.payload,
      created_at: event.created_at,
    };
  }

  private createEvent(
    input: BookingDomainEventPayload,
  ): Promise<BookingDomainEventRecord> {
    return this.bookingRepository.createDomainEvent(input);
  }

  private resolveStoredEventType(eventType: string): BookingDomainEventName {
    if (isBookingDomainEventName(eventType)) {
      return eventType;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unknown booking domain event type: ${eventType}`),
    );
  }
}
