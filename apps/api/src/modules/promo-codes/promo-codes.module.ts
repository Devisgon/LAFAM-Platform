// apps/api/src/modules/promo-codes/promo-codes.module.ts
/**
 * LAFAM Promo Codes module.
 *
 * Role:
 * - Registers Promo Code admin and customer controllers.
 * - Registers Promo Code application services.
 * - Registers Promo Code repository.
 * - Composes backend-owned promo-code creation, preview, validation, reservation, redemption, and release flows.
 *
 * Important:
 * - DatabaseModule provides the Supabase admin client used by PromoCodeRepository.
 * - AuthModule provides guards/session enforcement used by protected promo-code controllers.
 * - PaymentsModule provides PaymentPricingService for customer promo-code preview subtotal resolution.
 * - PromoCodeCustomerService is exported for Payment Module checkout/callback integration.
 * - Promo Code Module does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Promo codes apply before payment creation, not after payment is already paid.
 * - Wallet top-up is intentionally excluded from promo-code usage.
 * - Controllers stay thin.
 * - Services own orchestration.
 * - Domain policy owns pure promo-code business rules.
 * - Repository owns database/RPC access.
 */

import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromoCodeAdminService } from './application/promo-code-admin.service';
import { PromoCodeCustomerService } from './application/promo-code-customer.service';
import { PromoCodeAdminController } from './controllers/promo-code-admin.controller';
import { PromoCodeCustomerController } from './controllers/promo-code-customer.controller';
import { PromoCodeRepository } from './repositories/promo-code.repository';

@Module({
  imports: [DatabaseModule, AuthModule, forwardRef(() => PaymentsModule)],
  controllers: [PromoCodeAdminController, PromoCodeCustomerController],
  providers: [
    PromoCodeRepository,
    PromoCodeAdminService,
    PromoCodeCustomerService,
  ],
  exports: [PromoCodeCustomerService],
})
export class PromoCodesModule {}
