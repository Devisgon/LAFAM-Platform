// apps/api/src/modules/classes/application/pilates-class-event.service.ts
/**
 * LAFAM Pilates class event service.
 *
 * Role:
 * - Creates internal domain-event payloads after Pilates class/schedule mutations.
 * - Logs safe event metadata for audit/debug visibility.
 * - Keeps the Classes module ready for WebSocket/SSE broadcasting later.
 *
 * Important:
 * - This service does not write to the database.
 * - This service does not broadcast WebSocket messages yet.
 * - This service does not expose private user/customer data.
 * - Realtime gateway integration will later consume the same event payload shapes.
 */

import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppLoggerService } from '../../../common/logging/app-logger.service';
import type {
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import {
  PILATES_CLASS_EVENT_CLASS_CREATED,
  PILATES_CLASS_EVENT_CLASS_DELETED,
  PILATES_CLASS_EVENT_CLASS_UPDATED,
  PILATES_CLASS_EVENT_SCHEDULE_AVAILABILITY_CHANGED,
  PILATES_CLASS_EVENT_SCHEDULE_CANCELLED,
  PILATES_CLASS_EVENT_SCHEDULE_COMPLETED,
  PILATES_CLASS_EVENT_SCHEDULE_CREATED,
  PILATES_CLASS_EVENT_SCHEDULE_DELETED,
  PILATES_CLASS_EVENT_SCHEDULE_UPDATED,
  PILATES_CLASS_TEMPORARY_BOOKED_COUNT,
  PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE,
  PILATES_CLASS_TEMPORARY_WAITLIST_COUNT,
} from '../constants/pilates-class.constants';
import type {
  PilatesClassAvailabilitySnapshot,
  PilatesClassCreatedEventPayload,
  PilatesClassDeletedEventPayload,
  PilatesClassDomainEventPayload,
  PilatesClassUpdatedEventPayload,
  PilatesScheduleAvailabilityChangedEventPayload,
  PilatesScheduleCancelledEventPayload,
  PilatesScheduleCompletedEventPayload,
  PilatesScheduleCreatedEventPayload,
  PilatesScheduleDeletedEventPayload,
  PilatesScheduleUpdatedEventPayload,
} from '../types/pilates-class.types';

interface PilatesClassEventActorInput {
  readonly actor_admin_user_id?: string;
}

interface PilatesScheduleCancellationEventInput extends PilatesClassEventActorInput {
  readonly cancellation_reason: string;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function createEventId(): string {
  return randomUUID();
}

function createDefaultAvailabilitySnapshot(
  schedule: PilatesClassScheduleRow,
): PilatesClassAvailabilitySnapshot {
  return {
    capacity: schedule.capacity,
    booked_count: PILATES_CLASS_TEMPORARY_BOOKED_COUNT,
    available_seats: schedule.capacity,
    waitlist_count: PILATES_CLASS_TEMPORARY_WAITLIST_COUNT,
    waitlist_available: PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE,
    realtime_version: schedule.realtime_version,
  };
}

function resolveAvailabilitySnapshot(
  schedule: PilatesClassScheduleRow,
  availability?: PilatesClassAvailabilitySnapshot,
): PilatesClassAvailabilitySnapshot {
  return availability ?? createDefaultAvailabilitySnapshot(schedule);
}

@Injectable()
export class PilatesClassEventService {
  constructor(private readonly logger: AppLoggerService) {}

  recordClassCreated(
    record: PilatesClassRow,
    input: PilatesClassEventActorInput = {},
  ): PilatesClassCreatedEventPayload {
    const event: PilatesClassCreatedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_CLASS_CREATED,
      occurred_at: nowIsoString(),
      class_id: record.id,
      class_title: record.title,
      status: record.status,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordClassUpdated(
    record: PilatesClassRow,
    input: PilatesClassEventActorInput = {},
  ): PilatesClassUpdatedEventPayload {
    const event: PilatesClassUpdatedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_CLASS_UPDATED,
      occurred_at: nowIsoString(),
      class_id: record.id,
      class_title: record.title,
      status: record.status,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordClassDeleted(
    record: PilatesClassRow,
    input: PilatesClassEventActorInput = {},
  ): PilatesClassDeletedEventPayload {
    const event: PilatesClassDeletedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_CLASS_DELETED,
      occurred_at: nowIsoString(),
      class_id: record.id,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleCreated(
    record: PilatesClassScheduleRow,
    availability?: PilatesClassAvailabilitySnapshot,
    input: PilatesClassEventActorInput = {},
  ): PilatesScheduleCreatedEventPayload {
    const availabilitySnapshot = resolveAvailabilitySnapshot(
      record,
      availability,
    );

    const event: PilatesScheduleCreatedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_CREATED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      trainer_staff_profile_id: record.trainer_staff_profile_id,
      class_date: record.class_date,
      start_time: record.start_time,
      end_time: record.end_time,
      capacity: availabilitySnapshot.capacity,
      available_seats: availabilitySnapshot.available_seats,
      waitlist_count: availabilitySnapshot.waitlist_count,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleUpdated(
    record: PilatesClassScheduleRow,
    availability?: PilatesClassAvailabilitySnapshot,
    input: PilatesClassEventActorInput = {},
  ): PilatesScheduleUpdatedEventPayload {
    const availabilitySnapshot = resolveAvailabilitySnapshot(
      record,
      availability,
    );

    const event: PilatesScheduleUpdatedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_UPDATED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      trainer_staff_profile_id: record.trainer_staff_profile_id,
      class_date: record.class_date,
      start_time: record.start_time,
      end_time: record.end_time,
      capacity: availabilitySnapshot.capacity,
      available_seats: availabilitySnapshot.available_seats,
      waitlist_count: availabilitySnapshot.waitlist_count,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleCancelled(
    record: PilatesClassScheduleRow,
    input: PilatesScheduleCancellationEventInput,
  ): PilatesScheduleCancelledEventPayload {
    const event: PilatesScheduleCancelledEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_CANCELLED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      cancellation_reason: input.cancellation_reason,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleCompleted(
    record: PilatesClassScheduleRow,
    input: PilatesClassEventActorInput = {},
  ): PilatesScheduleCompletedEventPayload {
    const event: PilatesScheduleCompletedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_COMPLETED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleDeleted(
    record: PilatesClassScheduleRow,
    input: PilatesClassEventActorInput = {},
  ): PilatesScheduleDeletedEventPayload {
    const event: PilatesScheduleDeletedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_DELETED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  recordScheduleAvailabilityChanged(
    record: PilatesClassScheduleRow,
    availability?: PilatesClassAvailabilitySnapshot,
    input: PilatesClassEventActorInput = {},
  ): PilatesScheduleAvailabilityChangedEventPayload {
    const availabilitySnapshot = resolveAvailabilitySnapshot(
      record,
      availability,
    );

    const event: PilatesScheduleAvailabilityChangedEventPayload = {
      event_id: createEventId(),
      event_type: PILATES_CLASS_EVENT_SCHEDULE_AVAILABILITY_CHANGED,
      occurred_at: nowIsoString(),
      class_id: record.class_id,
      schedule_id: record.id,
      capacity: availabilitySnapshot.capacity,
      booked_count: availabilitySnapshot.booked_count,
      available_seats: availabilitySnapshot.available_seats,
      waitlist_count: availabilitySnapshot.waitlist_count,
      waitlist_available: availabilitySnapshot.waitlist_available,
      realtime_version: record.realtime_version,
      ...(input.actor_admin_user_id
        ? { actor_admin_user_id: input.actor_admin_user_id }
        : {}),
    };

    this.logEvent(event);

    return event;
  }

  private logEvent(event: PilatesClassDomainEventPayload): void {
    this.logger.log('Pilates class domain event recorded.', {
      context: PilatesClassEventService.name,
      metadata: {
        event,
      },
    });
  }
}
