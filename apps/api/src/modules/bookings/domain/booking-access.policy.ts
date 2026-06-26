// apps/api/src/modules/bookings/domain/booking-access.policy.ts
/**
 * LAFAM booking access policy.
 *
 * Role:
 * - Owns pure booking-management access checks.
 * - Separates full booking management from trainer-scoped booking management.
 * - Allows admin/super_admin/staff to manage all booking records.
 * - Allows trainer to manage only bookings tied to their own Pilates schedules.
 * - Validates selected schedule ownership before trainer bulk booking.
 *
 * Important:
 * - This policy does not query the database.
 * - This policy does not call Supabase.
 * - This policy does not mutate bookings, schedules, waitlists, or customers.
 * - Services must resolve trainer staff profile IDs before calling trainer-scoped checks.
 * - Repositories remain responsible for loading schedules/bookings/waitlist targets.
 */

import { AppError } from '../../../common/errors/app-error';
import type { AuthUserRole } from '../../auth/constants/auth-role.constants';
import {
  BOOKING_FULL_MANAGEMENT_ROLES,
  BOOKING_SCOPED_MANAGEMENT_ROLES,
} from '../constants/booking.constants';
import type {
  BookingFullManagementScope,
  BookingScheduleScopeSnapshot,
  BookingScopeCheckTarget,
  BookingStaffProfileId,
  BookingTrainerScopedManagementScope,
  BookingWaitlistScopeCheckTarget,
  ResolvedBookingManagementScope,
} from '../types/booking.types';

export interface ResolveBookingManagementScopeInput {
  readonly actor_user_id: string;
  readonly actor_role: AuthUserRole;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
}

export interface AssertScheduleScopesWithinManagementScopeInput {
  readonly scope: ResolvedBookingManagementScope;
  readonly requested_schedule_ids: readonly string[];
  readonly schedule_scopes: readonly BookingScheduleScopeSnapshot[];
}

export interface AssertBookingTargetWithinManagementScopeInput {
  readonly scope: ResolvedBookingManagementScope;
  readonly target: BookingScopeCheckTarget;
}

export interface AssertWaitlistTargetWithinManagementScopeInput {
  readonly scope: ResolvedBookingManagementScope;
  readonly target: BookingWaitlistScopeCheckTarget;
}

function isFullManagementRole(role: AuthUserRole): boolean {
  return BOOKING_FULL_MANAGEMENT_ROLES.includes(
    role as (typeof BOOKING_FULL_MANAGEMENT_ROLES)[number],
  );
}

function isScopedManagementRole(role: AuthUserRole): boolean {
  return BOOKING_SCOPED_MANAGEMENT_ROLES.includes(
    role as (typeof BOOKING_SCOPED_MANAGEMENT_ROLES)[number],
  );
}

function buildAccessDetails(
  scope: ResolvedBookingManagementScope,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    actor_user_id: scope.actor_user_id,
    actor_role: scope.actor_role,
    scope_kind: scope.scope_kind,
    trainer_staff_profile_id: scope.trainer_staff_profile_id,
    ...extra,
  };
}

function uniqueValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function findMissingScheduleIds(
  requestedScheduleIds: readonly string[],
  scheduleScopes: readonly BookingScheduleScopeSnapshot[],
): readonly string[] {
  const foundScheduleIdSet = new Set(
    scheduleScopes.map((scheduleScope) => scheduleScope.schedule_id),
  );

  return requestedScheduleIds.filter(
    (scheduleId) => !foundScheduleIdSet.has(scheduleId),
  );
}

function findOutOfScopeScheduleIds(
  trainerStaffProfileId: BookingStaffProfileId,
  scheduleScopes: readonly BookingScheduleScopeSnapshot[],
): readonly string[] {
  return scheduleScopes
    .filter(
      (scheduleScope) =>
        scheduleScope.trainer_staff_profile_id !== trainerStaffProfileId,
    )
    .map((scheduleScope) => scheduleScope.schedule_id);
}

function resolveFullManagementScope(
  input: ResolveBookingManagementScopeInput,
): BookingFullManagementScope {
  return {
    scope_kind: 'full',
    actor_user_id: input.actor_user_id,
    actor_role: input.actor_role,
    trainer_staff_profile_id: null,
  };
}

function resolveTrainerScopedManagementScope(
  input: ResolveBookingManagementScopeInput,
): BookingTrainerScopedManagementScope {
  if (input.trainer_staff_profile_id) {
    return {
      scope_kind: 'trainer_scoped',
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      trainer_staff_profile_id: input.trainer_staff_profile_id,
    };
  }

  throw AppError.trainerStaffProfileNotFound(
    'The active trainer staff profile for this user was not found.',
    {
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
    },
  );
}

export class BookingAccessPolicy {
  static resolveManagementScope(
    input: ResolveBookingManagementScopeInput,
  ): ResolvedBookingManagementScope {
    if (isFullManagementRole(input.actor_role)) {
      return resolveFullManagementScope(input);
    }

    if (isScopedManagementRole(input.actor_role)) {
      return resolveTrainerScopedManagementScope(input);
    }

    throw AppError.trainerScheduleScopeDenied(
      'This role is not allowed to manage bookings.',
      {
        actor_user_id: input.actor_user_id,
        actor_role: input.actor_role,
      },
    );
  }

  static isFullManagementScope(
    scope: ResolvedBookingManagementScope,
  ): scope is BookingFullManagementScope {
    return scope.scope_kind === 'full';
  }

  static isTrainerScopedManagementScope(
    scope: ResolvedBookingManagementScope,
  ): scope is BookingTrainerScopedManagementScope {
    return scope.scope_kind === 'trainer_scoped';
  }

  static assertFullManagementScope(
    scope: ResolvedBookingManagementScope,
  ): asserts scope is BookingFullManagementScope {
    if (this.isFullManagementScope(scope)) {
      return;
    }

    throw AppError.trainerScheduleScopeDenied(
      'This action requires full booking-management access.',
      buildAccessDetails(scope),
    );
  }

  static assertTrainerScopedManagementScopeHasProfile(
    scope: ResolvedBookingManagementScope,
  ): asserts scope is BookingTrainerScopedManagementScope {
    if (
      this.isTrainerScopedManagementScope(scope) &&
      scope.trainer_staff_profile_id
    ) {
      return;
    }

    throw AppError.trainerStaffProfileNotFound(
      'The active trainer staff profile for this user was not found.',
      buildAccessDetails(scope),
    );
  }

  static assertScheduleScopesWithinManagementScope(
    input: AssertScheduleScopesWithinManagementScopeInput,
  ): void {
    const requestedScheduleIds = uniqueValues(input.requested_schedule_ids);

    if (requestedScheduleIds.length === 0) {
      throw AppError.bulkBookingEmptySchedules(
        'At least one schedule must be selected for bulk booking.',
        buildAccessDetails(input.scope),
      );
    }

    const missingScheduleIds = findMissingScheduleIds(
      requestedScheduleIds,
      input.schedule_scopes,
    );

    if (missingScheduleIds.length > 0) {
      throw AppError.bulkBookingScheduleUnavailable(
        'One or more selected schedules are not available for booking.',
        buildAccessDetails(input.scope, {
          missing_schedule_ids: missingScheduleIds,
        }),
      );
    }

    if (this.isFullManagementScope(input.scope)) {
      return;
    }

    this.assertTrainerScopedManagementScopeHasProfile(input.scope);

    const outOfScopeScheduleIds = findOutOfScopeScheduleIds(
      input.scope.trainer_staff_profile_id,
      input.schedule_scopes,
    );

    if (outOfScopeScheduleIds.length === 0) {
      return;
    }

    throw AppError.trainerScheduleScopeDenied(
      'Trainer access is limited to bookings for their own schedules.',
      buildAccessDetails(input.scope, {
        out_of_scope_schedule_ids: outOfScopeScheduleIds,
      }),
    );
  }

  static assertBookingTargetWithinManagementScope(
    input: AssertBookingTargetWithinManagementScopeInput,
  ): void {
    if (this.isFullManagementScope(input.scope)) {
      return;
    }

    this.assertTrainerScopedManagementScopeHasProfile(input.scope);

    if (
      input.target.trainer_staff_profile_id ===
      input.scope.trainer_staff_profile_id
    ) {
      return;
    }

    throw AppError.trainerScheduleScopeDenied(
      'Trainer access is limited to bookings for their own schedules.',
      buildAccessDetails(input.scope, {
        booking_id: input.target.booking_id,
        schedule_id: input.target.schedule_id,
        target_trainer_staff_profile_id: input.target.trainer_staff_profile_id,
      }),
    );
  }

  static assertWaitlistTargetWithinManagementScope(
    input: AssertWaitlistTargetWithinManagementScopeInput,
  ): void {
    if (this.isFullManagementScope(input.scope)) {
      return;
    }

    this.assertTrainerScopedManagementScopeHasProfile(input.scope);

    if (
      input.target.trainer_staff_profile_id ===
      input.scope.trainer_staff_profile_id
    ) {
      return;
    }

    throw AppError.trainerScheduleScopeDenied(
      'Trainer access is limited to waitlist records for their own schedules.',
      buildAccessDetails(input.scope, {
        waitlist_id: input.target.waitlist_id,
        schedule_id: input.target.schedule_id,
        target_trainer_staff_profile_id: input.target.trainer_staff_profile_id,
      }),
    );
  }

  static assertCalendarScheduleWithinManagementScope(
    scope: ResolvedBookingManagementScope,
    scheduleScope: BookingScheduleScopeSnapshot,
  ): void {
    if (this.isFullManagementScope(scope)) {
      return;
    }

    this.assertTrainerScopedManagementScopeHasProfile(scope);

    if (
      scheduleScope.trainer_staff_profile_id === scope.trainer_staff_profile_id
    ) {
      return;
    }

    throw AppError.trainerScheduleScopeDenied(
      'Trainer calendar access is limited to their own schedules.',
      buildAccessDetails(scope, {
        schedule_id: scheduleScope.schedule_id,
        target_trainer_staff_profile_id: scheduleScope.trainer_staff_profile_id,
      }),
    );
  }

  static canReadScheduleScope(
    scope: ResolvedBookingManagementScope,
    scheduleScope: BookingScheduleScopeSnapshot,
  ): boolean {
    if (this.isFullManagementScope(scope)) {
      return true;
    }

    return (
      this.isTrainerScopedManagementScope(scope) &&
      scheduleScope.trainer_staff_profile_id === scope.trainer_staff_profile_id
    );
  }

  static filterScheduleScopesForManagementScope(
    scope: ResolvedBookingManagementScope,
    scheduleScopes: readonly BookingScheduleScopeSnapshot[],
  ): readonly BookingScheduleScopeSnapshot[] {
    if (this.isFullManagementScope(scope)) {
      return scheduleScopes;
    }

    return scheduleScopes.filter(
      (scheduleScope) =>
        scheduleScope.trainer_staff_profile_id ===
        scope.trainer_staff_profile_id,
    );
  }
}
