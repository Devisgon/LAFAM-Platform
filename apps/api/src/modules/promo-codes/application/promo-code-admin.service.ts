// apps/api/src/modules/promo-codes/application/promo-code-admin.service.ts
/**
 * LAFAM Promo Code admin service.
 *
 * Role:
 * - Orchestrates admin/staff promo-code management use cases.
 * - Applies Promo Code domain policy before repository mutations.
 * - Maps DTOs into repository/database contracts.
 * - Maps hydrated promo-code and redemption records into API response contracts.
 * - Enforces admin/staff visibility and ownership boundaries for promo-code management.
 *
 * Important:
 * - This service does not call Supabase directly.
 * - This service does not calculate payment truth outside the Promo Code policy.
 * - This service does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Staff-created promo codes are restricted by domain policy.
 * - Promo-code code and currency are intentionally not editable after creation.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  PROMO_CODE_ALLOWED_CREATOR_ROLES,
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_DEFAULT_CURRENCY,
  PROMO_CODE_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_DEFAULT_SORT_FIELD,
  PROMO_CODE_LIST_DEFAULT_LIMIT,
  PROMO_CODE_LIST_DEFAULT_OFFSET,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET,
  PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT,
  PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT,
  PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT,
  PROMO_CODE_STAFF_MAX_PER_USER_LIMIT,
  PROMO_CODE_STAFF_MAX_REDEMPTIONS,
  PROMO_CODE_STAFF_MAX_VALIDITY_DAYS,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedCreatorRole,
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
  PromoCodeStatus,
} from '../constants/promo-code.constants';
import { CreatePromoCodeDto } from '../dto/create-promo-code.dto';
import { ListPromoCodesQueryDto } from '../dto/list-promo-codes-query.dto';
import { ListPromoRedemptionsQueryDto } from '../dto/list-promo-redemptions-query.dto';
import { UpdatePromoCodeDto } from '../dto/update-promo-code.dto';
import { PromoCodePolicy } from '../domain/promo-code.policy';
import { PromoCodeRepository } from '../repositories/promo-code.repository';
import type {
  PromoCodeActor,
  PromoCodeCreateInput,
  PromoCodeHydratedRecord,
  PromoCodeListFilters,
  PromoCodeListResponse,
  PromoCodeRecord,
  PromoCodeRedemptionListFilters,
  PromoCodeRedemptionListResponse,
  PromoCodeRedemptionRecord,
  PromoCodeRedemptionResponse,
  PromoCodeResponse,
  PromoCodeTargetIdMutationInput,
  PromoCodeUpdateInput,
  PromoCodeUpdateRepositoryInput,
  PromoCodeUsageSummary,
} from '../types/promo-code.types';

interface PromoCodeStatusMutationServiceInput {
  readonly promo_code_id: string;
  readonly actor: PromoCodeActor;
}

interface PromoCodeDeleteServiceInput {
  readonly promo_code_id: string;
  readonly actor: PromoCodeActor;
}

function isAllowedCreatorRole(
  role: string,
): role is PromoCodeAllowedCreatorRole {
  return PROMO_CODE_ALLOWED_CREATOR_ROLES.some(
    (allowedRole) => allowedRole === role,
  );
}

function isAllowedTargetType(
  targetType: string,
): targetType is PromoCodeAllowedTargetType {
  return PROMO_CODE_ALLOWED_TARGET_TYPES.some(
    (allowedTargetType) => allowedTargetType === targetType,
  );
}

function isAllowedPaymentMethod(
  paymentMethod: string,
): paymentMethod is PromoCodeAllowedPaymentMethod {
  return PROMO_CODE_ALLOWED_PAYMENT_METHODS.some(
    (allowedPaymentMethod) => allowedPaymentMethod === paymentMethod,
  );
}

function toDatabaseJsonObject(
  value: Record<string, unknown> | DatabaseJsonObject | undefined,
): DatabaseJsonObject {
  if (value === undefined) {
    return {};
  }

  return value as DatabaseJsonObject;
}

function normalizeStringArray(values?: readonly string[]): string[] {
  if (values === undefined) {
    return [];
  }

  const normalizedValues = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(normalizedValues)];
}

function normalizeAllowedTargetTypes(
  values: readonly PromoCodeAllowedTargetType[],
): PromoCodeAllowedTargetType[] {
  return values.filter((value): value is PromoCodeAllowedTargetType =>
    isAllowedTargetType(value),
  );
}

function normalizeAllowedPaymentMethods(
  values?: readonly PromoCodeAllowedPaymentMethod[],
): PromoCodeAllowedPaymentMethod[] {
  if (values === undefined) {
    return [...PROMO_CODE_ALLOWED_PAYMENT_METHODS];
  }

  return values.filter((value): value is PromoCodeAllowedPaymentMethod =>
    isAllowedPaymentMethod(value),
  );
}

function normalizeTargetIdMutationInput(
  targetIds?: PromoCodeTargetIdMutationInput,
): PromoCodeTargetIdMutationInput | undefined {
  if (targetIds === undefined) {
    return undefined;
  }

  const normalizedTargetIds: {
    class_ids?: string[];
    schedule_ids?: string[];
    trainer_staff_profile_ids?: string[];
    customer_user_ids?: string[];
  } = {};

  if (targetIds.class_ids !== undefined) {
    normalizedTargetIds.class_ids = normalizeStringArray(targetIds.class_ids);
  }

  if (targetIds.schedule_ids !== undefined) {
    normalizedTargetIds.schedule_ids = normalizeStringArray(
      targetIds.schedule_ids,
    );
  }

  if (targetIds.trainer_staff_profile_ids !== undefined) {
    normalizedTargetIds.trainer_staff_profile_ids = normalizeStringArray(
      targetIds.trainer_staff_profile_ids,
    );
  }

  if (targetIds.customer_user_ids !== undefined) {
    normalizedTargetIds.customer_user_ids = normalizeStringArray(
      targetIds.customer_user_ids,
    );
  }

  return normalizedTargetIds;
}

function buildStaffLimitMetadata(actor: PromoCodeActor): DatabaseJsonObject {
  if (actor.role !== 'staff') {
    return {};
  }

  return {
    staff_limits_applied: true,
    max_percentage_discount: PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT,
    max_fixed_discount_amount: PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT,
    max_discount_amount: PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT,
    max_redemptions: PROMO_CODE_STAFF_MAX_REDEMPTIONS,
    max_per_user_limit: PROMO_CODE_STAFF_MAX_PER_USER_LIMIT,
    max_validity_days: PROMO_CODE_STAFF_MAX_VALIDITY_DAYS,
  };
}

@Injectable()
export class PromoCodeAdminService {
  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  async createPromoCode(
    actor: PromoCodeActor,
    dto: CreatePromoCodeDto,
  ): Promise<PromoCodeResponse> {
    const normalizedCode = PromoCodePolicy.normalizeCode(dto.code);
    const metadata = PromoCodePolicy.sanitizeMetadata(
      toDatabaseJsonObject(dto.metadata),
    ).metadata;
    const targetIds = PromoCodePolicy.normalizeTargetIds(dto.target_ids);

    const input: PromoCodeCreateInput = {
      code: normalizedCode,
      description: dto.description ?? null,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      max_discount_amount: dto.max_discount_amount ?? null,
      starts_at: dto.starts_at ?? null,
      ends_at: dto.ends_at ?? null,
      max_redemptions: dto.max_redemptions ?? null,
      per_user_limit: dto.per_user_limit ?? null,
      status: dto.status ?? 'draft',
      currency: dto.currency ?? PROMO_CODE_DEFAULT_CURRENCY,
      minimum_order_amount: dto.minimum_order_amount ?? 0,
      first_time_customer_only: dto.first_time_customer_only ?? false,
      allowed_target_types: normalizeAllowedTargetTypes(
        dto.allowed_target_types,
      ),
      allowed_payment_methods: normalizeAllowedPaymentMethods(
        dto.allowed_payment_methods,
      ),
      target_ids: targetIds,
      admin_notes: dto.admin_notes ?? null,
      metadata,
      actor,
    };

    PromoCodePolicy.assertCreateInput(input);

    const existingPromoCode =
      await this.promoCodeRepository.findPromoCodeByCode({
        code: input.code,
        include_deleted: true,
      });

    if (existingPromoCode) {
      throw AppError.promoCodeAlreadyExists(undefined, {
        code: input.code,
      });
    }

    const createdRecord = await this.promoCodeRepository.createPromoCode({
      promo_code: {
        code: input.code,
        description: input.description,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount_amount: input.max_discount_amount,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        max_redemptions: input.max_redemptions,
        per_user_limit: input.per_user_limit,
        status: input.status,
        created_by_admin_id: actor.user_id,
        updated_by_admin_id: actor.user_id,
        currency: input.currency,
        minimum_order_amount: input.minimum_order_amount,
        first_time_customer_only: input.first_time_customer_only,
        allowed_target_types: [...input.allowed_target_types],
        allowed_payment_methods: [
          ...(input.allowed_payment_methods ??
            PROMO_CODE_ALLOWED_PAYMENT_METHODS),
        ],
        created_by_role: actor.role,
        staff_limit_metadata: buildStaffLimitMetadata(actor),
        admin_notes: input.admin_notes,
        metadata: input.metadata,
      },
      target_ids: targetIds,
    });

    return PromoCodeAdminService.toPromoCodeResponse(createdRecord);
  }

  async listPromoCodes(
    actor: PromoCodeActor,
    query: ListPromoCodesQueryDto,
  ): Promise<PromoCodeListResponse> {
    PromoCodeAdminService.assertActorCanReadPromoCodes(actor);

    const filters = PromoCodeAdminService.toPromoCodeListFilters(actor, query);
    const result = await this.promoCodeRepository.listPromoCodes(filters);

    return {
      promo_codes: result.records.map((record) =>
        PromoCodeAdminService.toPromoCodeResponse(record),
      ),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async getPromoCode(
    actor: PromoCodeActor,
    promoCodeId: string,
  ): Promise<PromoCodeResponse> {
    const hydratedRecord =
      await this.promoCodeRepository.getPromoCodeByIdOrThrow(promoCodeId);

    PromoCodePolicy.assertActorCanManagePromoCode(
      actor,
      hydratedRecord.promo_code,
    );

    return PromoCodeAdminService.toPromoCodeResponse(hydratedRecord);
  }

  async updatePromoCode(
    actor: PromoCodeActor,
    promoCodeId: string,
    dto: UpdatePromoCodeDto,
  ): Promise<PromoCodeResponse> {
    const existingRecord =
      await this.promoCodeRepository.getPromoCodeByIdOrThrow(promoCodeId);

    PromoCodePolicy.assertActorCanManagePromoCode(
      actor,
      existingRecord.promo_code,
    );

    const metadata =
      dto.metadata === undefined
        ? undefined
        : PromoCodePolicy.sanitizeMetadata(toDatabaseJsonObject(dto.metadata))
            .metadata;

    const targetIds = normalizeTargetIdMutationInput(dto.target_ids);

    const input: PromoCodeUpdateInput = {
      promo_code_id: promoCodeId,
      description: dto.description,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      max_discount_amount: dto.max_discount_amount,
      starts_at: dto.starts_at,
      ends_at: dto.ends_at,
      max_redemptions: dto.max_redemptions,
      per_user_limit: dto.per_user_limit,
      status: dto.status,
      minimum_order_amount: dto.minimum_order_amount,
      first_time_customer_only: dto.first_time_customer_only,
      allowed_target_types: dto.allowed_target_types,
      allowed_payment_methods: dto.allowed_payment_methods,
      target_ids: targetIds,
      admin_notes: dto.admin_notes,
      metadata,
      actor,
    };

    PromoCodePolicy.assertUpdateInput(input);

    if (input.status !== undefined) {
      PromoCodePolicy.assertStatusTransition(
        existingRecord.promo_code.status,
        input.status,
      );
    }

    const hasRedemptions =
      await this.promoCodeRepository.hasAnyRedemptionsForPromoCode(promoCodeId);

    PromoCodePolicy.assertUpdateAllowedAfterRedemptions(input, hasRedemptions);

    const updateInput =
      PromoCodeAdminService.toPromoCodeUpdateRepositoryInput(input);

    const updatedRecord =
      await this.promoCodeRepository.updatePromoCode(updateInput);

    return PromoCodeAdminService.toPromoCodeResponse(updatedRecord);
  }

  async activatePromoCode(
    input: PromoCodeStatusMutationServiceInput,
  ): Promise<PromoCodeResponse> {
    return this.setPromoCodeStatus(input, 'active');
  }

  async pausePromoCode(
    input: PromoCodeStatusMutationServiceInput,
  ): Promise<PromoCodeResponse> {
    return this.setPromoCodeStatus(input, 'paused');
  }

  async deletePromoCode(
    input: PromoCodeDeleteServiceInput,
  ): Promise<PromoCodeResponse> {
    const existingRecord =
      await this.promoCodeRepository.getPromoCodeByIdOrThrow(
        input.promo_code_id,
      );

    PromoCodePolicy.assertActorCanManagePromoCode(
      input.actor,
      existingRecord.promo_code,
    );

    if (
      existingRecord.promo_code.status === 'deleted' ||
      existingRecord.promo_code.deleted_at !== null
    ) {
      throw AppError.promoCodeAlreadyDeleted(undefined, {
        promo_code_id: input.promo_code_id,
      });
    }

    const deletedRecord = await this.promoCodeRepository.softDeletePromoCode({
      promo_code_id: input.promo_code_id,
      updated_by_admin_id: input.actor.user_id,
    });

    return PromoCodeAdminService.toPromoCodeResponse(deletedRecord);
  }

  async listPromoCodeRedemptions(
    actor: PromoCodeActor,
    query: ListPromoRedemptionsQueryDto,
    promoCodeId?: string,
  ): Promise<PromoCodeRedemptionListResponse> {
    PromoCodeAdminService.assertActorCanReadPromoCodes(actor);

    const effectivePromoCodeId = promoCodeId ?? query.promo_code_id;

    if (effectivePromoCodeId) {
      const promoCode =
        await this.promoCodeRepository.getPromoCodeByIdOrThrow(
          effectivePromoCodeId,
        );

      PromoCodePolicy.assertActorCanManagePromoCode(
        actor,
        promoCode.promo_code,
      );
    } else if (actor.role === 'staff') {
      throw AppError.promoCodeStaffLimitExceeded(
        'Staff must request redemption history for a promo code they created.',
        {
          actor_user_id: actor.user_id,
          actor_role: actor.role,
        },
      );
    }

    const filters = PromoCodeAdminService.toPromoCodeRedemptionListFilters(
      query,
      effectivePromoCodeId,
    );

    const result = await this.promoCodeRepository.listRedemptions(filters);

    return {
      redemptions: result.records.map((record) =>
        PromoCodeAdminService.toPromoCodeRedemptionResponse(record),
      ),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private async setPromoCodeStatus(
    input: PromoCodeStatusMutationServiceInput,
    nextStatus: PromoCodeStatus,
  ): Promise<PromoCodeResponse> {
    const existingRecord =
      await this.promoCodeRepository.getPromoCodeByIdOrThrow(
        input.promo_code_id,
      );

    PromoCodePolicy.assertActorCanManagePromoCode(
      input.actor,
      existingRecord.promo_code,
    );
    PromoCodePolicy.assertStatusTransition(
      existingRecord.promo_code.status,
      nextStatus,
    );

    const updatedRecord = await this.promoCodeRepository.setPromoCodeStatus({
      promo_code_id: input.promo_code_id,
      status: nextStatus,
      updated_by_admin_id: input.actor.user_id,
    });

    return PromoCodeAdminService.toPromoCodeResponse(updatedRecord);
  }

  private static assertActorCanReadPromoCodes(actor: PromoCodeActor): void {
    if (
      actor.role === 'admin' ||
      actor.role === 'super_admin' ||
      actor.role === 'staff'
    ) {
      return;
    }

    throw AppError.promoCodeStaffLimitExceeded(
      'This role cannot access promo-code admin APIs.',
      {
        actor_user_id: actor.user_id,
        actor_role: actor.role,
      },
    );
  }

  private static toPromoCodeListFilters(
    actor: PromoCodeActor,
    query: ListPromoCodesQueryDto,
  ): PromoCodeListFilters {
    return {
      search: query.search,
      status: query.status,
      discount_type: query.discount_type,
      target_type: query.target_type,
      payment_method: query.payment_method,
      created_by_admin_id:
        actor.role === 'staff' ? actor.user_id : query.created_by_admin_id,
      created_by_role: actor.role === 'staff' ? 'staff' : query.created_by_role,
      starts_from: query.starts_from,
      starts_to: query.starts_to,
      ends_from: query.ends_from,
      ends_to: query.ends_to,
      include_deleted: query.include_deleted === true,
      limit: query.limit ?? PROMO_CODE_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? PROMO_CODE_LIST_DEFAULT_OFFSET,
      sort_by: query.sort_by ?? PROMO_CODE_DEFAULT_SORT_FIELD,
      sort_direction: query.sort_direction ?? PROMO_CODE_DEFAULT_SORT_DIRECTION,
    };
  }

  private static toPromoCodeRedemptionListFilters(
    query: ListPromoRedemptionsQueryDto,
    promoCodeId?: string,
  ): PromoCodeRedemptionListFilters {
    return {
      promo_code_id: promoCodeId ?? query.promo_code_id,
      user_id: query.user_id,
      payment_id: query.payment_id,
      status: query.status,
      target_type: query.target_type,
      booking_id: query.booking_id,
      private_booking_id: query.private_booking_id,
      booking_order_id: query.booking_order_id,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit ?? PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET,
      sort_by: query.sort_by ?? PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD,
      sort_direction:
        query.sort_direction ?? PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION,
    };
  }

  private static toPromoCodeUpdateRepositoryInput(
    input: PromoCodeUpdateInput,
  ): PromoCodeUpdateRepositoryInput {
    const promoCodeUpdate: PromoCodeUpdateRepositoryInput['promo_code'] = {
      updated_by_admin_id: input.actor.user_id,
    };

    if (input.description !== undefined) {
      promoCodeUpdate.description = input.description;
    }

    if (input.discount_type !== undefined) {
      promoCodeUpdate.discount_type = input.discount_type;
    }

    if (input.discount_value !== undefined) {
      promoCodeUpdate.discount_value = input.discount_value;
    }

    if (input.max_discount_amount !== undefined) {
      promoCodeUpdate.max_discount_amount = input.max_discount_amount;
    }

    if (input.starts_at !== undefined) {
      promoCodeUpdate.starts_at = input.starts_at;
    }

    if (input.ends_at !== undefined) {
      promoCodeUpdate.ends_at = input.ends_at;
    }

    if (input.max_redemptions !== undefined) {
      promoCodeUpdate.max_redemptions = input.max_redemptions;
    }

    if (input.per_user_limit !== undefined) {
      promoCodeUpdate.per_user_limit = input.per_user_limit;
    }

    if (input.status !== undefined) {
      promoCodeUpdate.status = input.status;
    }

    if (input.minimum_order_amount !== undefined) {
      promoCodeUpdate.minimum_order_amount = input.minimum_order_amount;
    }

    if (input.first_time_customer_only !== undefined) {
      promoCodeUpdate.first_time_customer_only = input.first_time_customer_only;
    }

    if (input.allowed_target_types !== undefined) {
      promoCodeUpdate.allowed_target_types = [...input.allowed_target_types];
    }

    if (input.allowed_payment_methods !== undefined) {
      promoCodeUpdate.allowed_payment_methods = [
        ...input.allowed_payment_methods,
      ];
    }

    if (input.admin_notes !== undefined) {
      promoCodeUpdate.admin_notes = input.admin_notes;
    }

    if (input.metadata !== undefined) {
      promoCodeUpdate.metadata = input.metadata;
    }

    return {
      promo_code_id: input.promo_code_id,
      promo_code: promoCodeUpdate,
      target_ids: input.target_ids,
    };
  }

  private static toPromoCodeResponse(
    hydratedRecord: PromoCodeHydratedRecord,
  ): PromoCodeResponse {
    const promoCode = hydratedRecord.promo_code;
    const targetIds = PromoCodePolicy.extractTargetIds(hydratedRecord);

    return {
      id: promoCode.id,
      code: promoCode.code,
      description: promoCode.description,
      discount_type: promoCode.discount_type,
      discount_value: promoCode.discount_value,
      max_discount_amount: promoCode.max_discount_amount,
      starts_at: promoCode.starts_at,
      ends_at: promoCode.ends_at,
      max_redemptions: promoCode.max_redemptions,
      per_user_limit: promoCode.per_user_limit,
      redemption_count: promoCode.redemption_count,
      status: promoCode.status,
      currency: promoCode.currency,
      minimum_order_amount: promoCode.minimum_order_amount,
      first_time_customer_only: promoCode.first_time_customer_only,
      allowed_target_types: PromoCodeAdminService.toAllowedTargetTypeResponse(
        promoCode.allowed_target_types,
      ),
      allowed_payment_methods:
        PromoCodeAdminService.toAllowedPaymentMethodResponse(
          promoCode.allowed_payment_methods,
        ),
      targets: {
        class_ids: targetIds.class_ids,
        schedule_ids: targetIds.schedule_ids,
        trainer_staff_profile_ids: targetIds.trainer_staff_profile_ids,
        customer_user_ids: targetIds.customer_user_ids,
      },
      usage: PromoCodeAdminService.toPromoCodeUsageSummary(promoCode),
      created_by_admin_id: promoCode.created_by_admin_id,
      updated_by_admin_id: promoCode.updated_by_admin_id,
      created_by_role: PromoCodeAdminService.toCreatorRoleResponse(
        promoCode.created_by_role,
      ),
      admin_notes: promoCode.admin_notes,
      metadata: promoCode.metadata,
      created_at: promoCode.created_at,
      updated_at: promoCode.updated_at,
      deleted_at: promoCode.deleted_at,
    };
  }

  private static toPromoCodeUsageSummary(
    promoCode: PromoCodeRecord,
  ): PromoCodeUsageSummary {
    const remainingRedemptions =
      promoCode.max_redemptions === null
        ? null
        : Math.max(promoCode.max_redemptions - promoCode.redemption_count, 0);

    return {
      redemption_count: promoCode.redemption_count,
      max_redemptions: promoCode.max_redemptions,
      per_user_limit: promoCode.per_user_limit,
      remaining_redemptions: remainingRedemptions,
    };
  }

  private static toPromoCodeRedemptionResponse(
    record: PromoCodeRedemptionRecord,
  ): PromoCodeRedemptionResponse {
    return {
      id: record.id,
      promo_code_id: record.promo_code_id,
      user_id: record.user_id,
      payment_id: record.payment_id,
      target_type: PromoCodeAdminService.toAllowedTargetType(
        record.target_type,
      ),
      booking_id: record.booking_id,
      private_booking_id: record.private_booking_id,
      booking_order_id: record.booking_order_id,
      payment_method: PromoCodeAdminService.toAllowedPaymentMethod(
        record.payment_method,
      ),
      idempotency_key: record.idempotency_key,
      status: record.status,
      subtotal_amount: record.subtotal_amount,
      discount_amount: record.discount_amount,
      final_amount: record.final_amount,
      currency: record.currency,
      reserved_at: record.reserved_at,
      redeemed_at: record.redeemed_at,
      released_at: record.released_at,
      expires_at: record.expires_at,
      release_reason: record.release_reason,
      metadata: record.metadata,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  private static toAllowedTargetTypeResponse(
    targetTypes: readonly string[],
  ): readonly PromoCodeAllowedTargetType[] {
    return targetTypes.map((targetType) =>
      PromoCodeAdminService.toAllowedTargetType(targetType),
    );
  }

  private static toAllowedPaymentMethodResponse(
    paymentMethods: readonly string[],
  ): readonly PromoCodeAllowedPaymentMethod[] {
    return paymentMethods.map((paymentMethod) =>
      PromoCodeAdminService.toAllowedPaymentMethod(paymentMethod),
    );
  }

  private static toAllowedTargetType(
    targetType: string,
  ): PromoCodeAllowedTargetType {
    if (isAllowedTargetType(targetType)) {
      return targetType;
    }

    throw AppError.promoCodeTargetInvalid(
      'Stored promo-code target type is invalid.',
      {
        target_type: targetType,
      },
    );
  }

  private static toAllowedPaymentMethod(
    paymentMethod: string,
  ): PromoCodeAllowedPaymentMethod {
    if (isAllowedPaymentMethod(paymentMethod)) {
      return paymentMethod;
    }

    throw AppError.promoCodePaymentMethodNotAllowed(
      'Stored promo-code payment method is invalid.',
      {
        payment_method: paymentMethod,
      },
    );
  }

  private static toCreatorRoleResponse(
    role: string | null,
  ): PromoCodeAllowedCreatorRole | null {
    if (role === null) {
      return null;
    }

    if (isAllowedCreatorRole(role)) {
      return role;
    }

    throw AppError.promoCodeInvalid(
      'Stored promo-code creator role is invalid.',
      {
        created_by_role: role,
      },
    );
  }
}
