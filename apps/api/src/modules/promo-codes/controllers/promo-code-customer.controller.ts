// apps/api/src/modules/promo-codes/controllers/promo-code-customer.controller.ts
/**
 * LAFAM Promo Code customer controller.
 *
 * Role:
 * - Exposes protected customer Promo Code Module endpoints.
 * - Allows authenticated customers to preview promo-code eligibility before checkout payment creation.
 * - Resolves backend-owned checkout subtotal through PaymentPricingService before promo-code preview.
 * - Delegates promo-code validation and discount calculation to PromoCodeCustomerService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts this endpoint to customer users.
 * - Controller does not trust subtotal, discount, final amount, redemption count, or payment truth from request body.
 * - Controller does not reserve, redeem, or release promo-code redemptions.
 * - Preview does not consume promo-code usage.
 * - Checkout must revalidate and reserve the promo code again.
 * - Promo codes are intentionally not allowed for wallet top-up.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { PaymentPricingService } from '../../payments/application/payment-pricing.service';
import type { PaymentPriceResolutionResult } from '../../payments/types/payment.types';
import { PromoCodeCustomerService } from '../application/promo-code-customer.service';
import {
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_ROUTE_PREFIX,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
} from '../constants/promo-code.constants';
import { PreviewPromoCodeDto } from '../dto/preview-promo-code.dto';
import type {
  PromoCodePreviewResponse,
  PromoCodeResolvedCheckoutTarget,
} from '../types/promo-code.types';

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

function isPromoCodeAllowedTargetType(
  targetType: string,
): targetType is PromoCodeAllowedTargetType {
  return PROMO_CODE_ALLOWED_TARGET_TYPES.some(
    (allowedTargetType) => allowedTargetType === targetType,
  );
}

function resolvePromoCodeAllowedTargetType(
  targetType: string,
): PromoCodeAllowedTargetType {
  if (isPromoCodeAllowedTargetType(targetType)) {
    return targetType;
  }

  throw AppError.promoCodeTargetNotAllowed(
    'Promo codes are not supported for this checkout target.',
    {
      target_type: targetType,
    },
  );
}

function readOptionalStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const propertyValue = value[key];

  return typeof propertyValue === 'string' && propertyValue.trim().length > 0
    ? propertyValue
    : null;
}

function toResolvedPromoCodeCheckoutTarget(input: {
  readonly user_id: string;
  readonly payment_method: PromoCodeAllowedPaymentMethod;
  readonly pricing: PaymentPriceResolutionResult;
}): PromoCodeResolvedCheckoutTarget {
  const pricingTarget = input.pricing.target;
  const pricingTargetRecord = pricingTarget as unknown as Record<
    string,
    unknown
  >;

  return {
    user_id: input.user_id,
    target_type: resolvePromoCodeAllowedTargetType(pricingTarget.target_type),
    booking_id: pricingTarget.booking_id,
    private_booking_id: pricingTarget.private_booking_id,
    booking_order_id: pricingTarget.booking_order_id,
    subtotal_amount: input.pricing.amount,
    currency: input.pricing.currency,
    payment_method: input.payment_method,
    class_id: readOptionalStringProperty(pricingTargetRecord, 'class_id'),
    schedule_id: readOptionalStringProperty(pricingTargetRecord, 'schedule_id'),
    trainer_staff_profile_id: readOptionalStringProperty(
      pricingTargetRecord,
      'trainer_staff_profile_id',
    ),
    metadata: {
      preview_source: 'promo_code_customer_controller',
    },
  };
}

@Controller(PROMO_CODE_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_CUSTOMER_ROLE)
export class PromoCodeCustomerController {
  constructor(
    private readonly promoCodeCustomerService: PromoCodeCustomerService,
    private readonly paymentPricingService: PaymentPricingService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async previewPromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: PreviewPromoCodeDto,
  ): Promise<ApiSuccessResponse<PromoCodePreviewResponse>> {
    const userId = resolveAuthenticatedCustomerId(auth);
    const paymentMethod = body.payment_method ?? 'knet';

    const pricing = await this.paymentPricingService.resolveCheckoutPricing({
      user_id: userId,
      target_type: body.target_type,
      booking_id: body.booking_id ?? null,
      private_booking_id: body.private_booking_id ?? null,
      booking_order_id: body.booking_order_id ?? null,
      wallet_top_up_amount: undefined,
      currency: undefined,
      promo_code: undefined,
    });

    const data = await this.promoCodeCustomerService.previewPromoCode({
      user_id: userId,
      dto: body,
      target: toResolvedPromoCodeCheckoutTarget({
        user_id: userId,
        payment_method: paymentMethod,
        pricing,
      }),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code preview calculated successfully.',
      data,
    });
  }
}
