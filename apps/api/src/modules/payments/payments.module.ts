// apps/api/src/modules/payments/payments.module.ts
/**
 * LAFAM Payments module.
 *
 * Role:
 * - Registers Payment and Wallet controllers.
 * - Registers Payment and Wallet application services.
 * - Registers Payment and Wallet repositories.
 * - Registers provider adapter bindings for mock and KNET gateways.
 * - Registers the Payment-specific rate-limit guard used by payment controllers.
 * - Composes hosted checkout, wallet checkout, callback/webhook handling,
 *   admin refunds, unpaid payment expiry, and wallet top-up flows.
 *
 * Important:
 * - This module is the backend composition boundary for payments and wallets.
 * - DatabaseModule provides the Supabase admin client used by repositories/services.
 * - AuthModule provides guards/session enforcement used by protected controllers.
 * - Booking-order payment support is handled through PaymentRepository, WalletRepository,
 *   PaymentPricingService, PaymentCheckoutService, and payment/wallet database RPCs.
 * - This module does not import BookingsModule because current payment services do not
 *   inject booking services or booking repositories.
 * - mark_payment_paid_atomic is the settlement boundary for booking, private booking,
 *   booking-order, and wallet top-up paid transitions.
 * - debit_wallet_for_booking_order_atomic is the wallet settlement boundary for
 *   booking-order wallet checkout.
 * - MockPaymentProviderService is used for local development.
 * - KnetPaymentProviderService is registered but intentionally conservative until a real provider contract is added.
 * - Tap, MyFatoorah, and Checkout.com provider tokens are intentionally not bound yet because no concrete adapters exist.
 * - Controllers stay thin.
 * - Services own orchestration.
 * - Repositories own database/RPC access.
 * - Atomic database RPCs own final payment/wallet mutation.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { KnetPaymentProviderService } from './application/knet-payment-provider.service';
import { MockPaymentProviderService } from './application/mock-payment-provider.service';
import { PaymentAdminService } from './application/payment-admin.service';
import { PaymentCallbackService } from './application/payment-callback.service';
import { PaymentCheckoutService } from './application/payment-checkout.service';
import {
  PAYMENT_KNET_GATEWAY_PROVIDER,
  PAYMENT_MOCK_GATEWAY_PROVIDER,
  PaymentGatewayService,
} from './application/payment-gateway.service';
import { PaymentPricingService } from './application/payment-pricing.service';
import { WalletService } from './application/wallet.service';
import { PaymentAdminController } from './controllers/payment-admin.controller';
import { PaymentCustomerController } from './controllers/payment-customer.controller';
import { PaymentPublicController } from './controllers/payment-public.controller';
import { WalletAdminController } from './controllers/wallet-admin.controller';
import { WalletCustomerController } from './controllers/wallet-customer.controller';
import { PaymentRateLimitGuard } from './guards/payment-rate-limit.guard';
import { PaymentRepository } from './repositories/payment.repository';
import { WalletRepository } from './repositories/wallet.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    PaymentCustomerController,
    PaymentPublicController,
    PaymentAdminController,
    WalletCustomerController,
    WalletAdminController,
  ],
  providers: [
    PaymentRepository,
    WalletRepository,
    PaymentPricingService,
    PaymentGatewayService,
    KnetPaymentProviderService,
    MockPaymentProviderService,
    PaymentCheckoutService,
    PaymentCallbackService,
    WalletService,
    PaymentAdminService,
    PaymentRateLimitGuard,
    {
      provide: PAYMENT_MOCK_GATEWAY_PROVIDER,
      useExisting: MockPaymentProviderService,
    },
    {
      provide: PAYMENT_KNET_GATEWAY_PROVIDER,
      useExisting: KnetPaymentProviderService,
    },
  ],
  exports: [
    PaymentRepository,
    WalletRepository,
    PaymentPricingService,
    PaymentGatewayService,
    PaymentCheckoutService,
    PaymentCallbackService,
    WalletService,
    PaymentAdminService,
    PAYMENT_MOCK_GATEWAY_PROVIDER,
    PAYMENT_KNET_GATEWAY_PROVIDER,
  ],
})
export class PaymentsModule {}
