// apps/api/src/modules/payments/controllers/payment-public.controller.ts
/**
 * LAFAM public payment controller.
 *
 * Role:
 * - Exposes hosted payment browser callback endpoint.
 * - Exposes hosted provider webhook endpoint.
 * - Converts provider callback/query/body/header data into service contracts.
 * - Delegates all settlement logic to PaymentCallbackService.
 *
 * Important:
 * - Browser callback is not payment truth.
 * - Webhook body is not payment truth until signature and provider verification pass.
 * - This controller does not mark payments paid.
 * - This controller does not confirm bookings.
 * - This controller does not credit or debit wallets.
 * - Public routes are rate-limited because they are internet-facing.
 * - Non-mock webhooks require raw body preservation for signature verification.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

import { currentPaymentConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
import { PaymentCallbackService } from '../application/payment-callback.service';
import {
  PAYMENT_KNET_CALLBACK_ROUTE,
  PAYMENT_KNET_WEBHOOK_ROUTE,
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PUBLIC_ROUTE_PREFIX,
  PAYMENT_RATE_LIMIT_CALLBACK,
  PAYMENT_RATE_LIMIT_WEBHOOK,
  PAYMENT_WEBHOOK_EVENT_ID_HEADER_NAMES,
  PAYMENT_WEBHOOK_SIGNATURE_HEADER_NAMES,
  PAYMENT_WEBHOOK_TIMESTAMP_HEADER_NAMES,
  isPaymentExternalGatewayProvider,
  type PaymentExternalGatewayProvider,
} from '../constants/payment.constants';
import { PaymentCallbackQueryDto } from '../dto/payment-callback-query.dto';
import { PaymentWebhookDto } from '../dto/payment-webhook.dto';
import {
  PaymentRateLimit,
  PaymentRateLimitGuard,
} from '../guards/payment-rate-limit.guard';
import type {
  PaymentCallbackInput,
  PaymentCallbackResultPayload,
  PaymentWebhookHandlingResult,
  PaymentWebhookInput,
} from '../types/payment.types';

interface RawBodyRequest {
  readonly rawBody?: Buffer | string;
  readonly body?: unknown;
}

interface RedirectRouteResult {
  readonly url: string;
  readonly statusCode: number;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (!hasText(value)) {
    return null;
  }

  return value.trim();
}

function resolveConfiguredExternalProvider(): PaymentExternalGatewayProvider {
  const provider = currentPaymentConfig.provider;

  if (isPaymentExternalGatewayProvider(provider)) {
    return provider;
  }

  throw AppError.paymentProviderUnavailable({
    provider,
    reason:
      'Configured payment provider cannot receive hosted callback or webhook events.',
  });
}

function firstHeaderValue(
  headers: IncomingHttpHeaders,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = headers[name.toLowerCase()];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim().length > 0) {
          return item.trim();
        }
      }
    }
  }

  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDatabaseJson(value: unknown): value is DatabaseJson {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isDatabaseJson);
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === 'undefined' || isDatabaseJson(entry),
  );
}

function toDatabaseJsonObject(
  value: Record<string, unknown> | undefined,
): DatabaseJsonObject {
  const result: DatabaseJsonObject = {};

  if (typeof value === 'undefined') {
    return result;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'undefined') {
      continue;
    }

    if (isDatabaseJson(entry)) {
      result[key] = entry;
    }
  }

  return result;
}

function assignOptionalJsonValue(
  target: DatabaseJsonObject,
  key: string,
  value: DatabaseJson | undefined,
): void {
  if (typeof value === 'undefined') {
    return;
  }

  target[key] = value;
}

function buildCallbackRawQuery(
  query: PaymentCallbackQueryDto,
): DatabaseJsonObject {
  const rawQuery: DatabaseJsonObject = {};

  assignOptionalJsonValue(rawQuery, 'payment_id', query.payment_id);
  assignOptionalJsonValue(
    rawQuery,
    'provider_reference',
    query.provider_reference,
  );
  assignOptionalJsonValue(
    rawQuery,
    'gateway_payment_id',
    query.gateway_payment_id,
  );
  assignOptionalJsonValue(
    rawQuery,
    'gateway_invoice_id',
    query.gateway_invoice_id,
  );
  assignOptionalJsonValue(rawQuery, 'result', query.result);
  assignOptionalJsonValue(rawQuery, 'transaction_id', query.transaction_id);
  assignOptionalJsonValue(rawQuery, 'invoice_id', query.invoice_id);
  assignOptionalJsonValue(rawQuery, 'reference_id', query.reference_id);

  return rawQuery;
}

function buildCallbackInput(input: {
  readonly provider: PaymentExternalGatewayProvider;
  readonly query: PaymentCallbackQueryDto;
}): PaymentCallbackInput {
  return {
    provider: input.provider,
    payment_id: normalizeOptionalText(input.query.payment_id),
    provider_reference:
      normalizeOptionalText(input.query.provider_reference) ??
      normalizeOptionalText(input.query.reference_id),
    gateway_payment_id:
      normalizeOptionalText(input.query.gateway_payment_id) ??
      normalizeOptionalText(input.query.transaction_id),
    gateway_invoice_id:
      normalizeOptionalText(input.query.gateway_invoice_id) ??
      normalizeOptionalText(input.query.invoice_id),
    result: input.query.result ?? null,
    raw_query: buildCallbackRawQuery(input.query),
  };
}

function buildWebhookPayload(body: PaymentWebhookDto): DatabaseJsonObject {
  const providerPayload = toDatabaseJsonObject(body.payload);
  const payload: DatabaseJsonObject = {
    ...providerPayload,
    event_type: body.event_type,
  };

  assignOptionalJsonValue(payload, 'event_id', body.event_id);
  assignOptionalJsonValue(payload, 'payment_id', body.payment_id);
  assignOptionalJsonValue(
    payload,
    'provider_reference',
    body.provider_reference ?? body.reference_id,
  );
  assignOptionalJsonValue(
    payload,
    'gateway_payment_id',
    body.gateway_payment_id ?? body.transaction_id,
  );
  assignOptionalJsonValue(
    payload,
    'gateway_invoice_id',
    body.gateway_invoice_id ?? body.invoice_id,
  );
  assignOptionalJsonValue(payload, 'status', body.status);
  assignOptionalJsonValue(payload, 'failure_code', body.failure_code);
  assignOptionalJsonValue(payload, 'failure_message', body.failure_message);
  assignOptionalJsonValue(payload, 'occurred_at', body.occurred_at);
  assignOptionalJsonValue(payload, 'transaction_id', body.transaction_id);
  assignOptionalJsonValue(payload, 'invoice_id', body.invoice_id);
  assignOptionalJsonValue(payload, 'reference_id', body.reference_id);

  return payload;
}

function resolveRawWebhookBody(input: {
  readonly request: RawBodyRequest;
  readonly provider: PaymentExternalGatewayProvider;
  readonly fallbackPayload: DatabaseJsonObject;
}): string {
  if (Buffer.isBuffer(input.request.rawBody)) {
    return input.request.rawBody.toString('utf8');
  }

  if (typeof input.request.rawBody === 'string') {
    return input.request.rawBody;
  }

  if (input.provider === PAYMENT_PROVIDER_MOCK) {
    return JSON.stringify(input.fallbackPayload);
  }

  throw AppError.paymentWebhookInvalid(
    'Raw webhook body is required for non-mock payment webhook signature verification.',
    {
      provider: input.provider,
      reason:
        'Enable raw body preservation in the HTTP adapter before enabling live payment webhooks.',
    },
  );
}

function buildWebhookHeaders(
  headers: IncomingHttpHeaders,
): PaymentWebhookInput['headers'] {
  return {
    signature: firstHeaderValue(
      headers,
      PAYMENT_WEBHOOK_SIGNATURE_HEADER_NAMES,
    ),
    timestamp: firstHeaderValue(
      headers,
      PAYMENT_WEBHOOK_TIMESTAMP_HEADER_NAMES,
    ),
    event_id: firstHeaderValue(headers, PAYMENT_WEBHOOK_EVENT_ID_HEADER_NAMES),
  };
}

@Controller(PAYMENT_PUBLIC_ROUTE_PREFIX)
@UseGuards(PaymentRateLimitGuard)
export class PaymentPublicController {
  constructor(
    private readonly paymentCallbackService: PaymentCallbackService,
  ) {}

  @Get(PAYMENT_KNET_CALLBACK_ROUTE)
  @Redirect('', HttpStatus.FOUND)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_CALLBACK)
  async handleKnetCallback(
    @Query() query: PaymentCallbackQueryDto,
  ): Promise<RedirectRouteResult> {
    const provider = resolveConfiguredExternalProvider();

    const result: PaymentCallbackResultPayload =
      await this.paymentCallbackService.handleCallback(
        buildCallbackInput({
          provider,
          query,
        }),
      );

    return {
      url: result.frontend_redirect_url,
      statusCode: HttpStatus.FOUND,
    };
  }

  @Post(PAYMENT_KNET_WEBHOOK_ROUTE)
  @HttpCode(HttpStatus.OK)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WEBHOOK)
  async handleKnetWebhook(
    @Headers() headers: IncomingHttpHeaders,
    @Req() request: RawBodyRequest,
    @Body() body: PaymentWebhookDto,
  ): Promise<ApiSuccessResponse<PaymentWebhookHandlingResult>> {
    const provider = resolveConfiguredExternalProvider();
    const payload = buildWebhookPayload(body);

    const result = await this.paymentCallbackService.handleWebhook({
      provider,
      headers: buildWebhookHeaders(headers),
      raw_body: resolveRawWebhookBody({
        request,
        provider,
        fallbackPayload: payload,
      }),
      payload,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Payment webhook processed successfully.',
      data: result,
    });
  }
}
