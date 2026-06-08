// apps/api/src/common/responses/api-response.ts
/**
 * LAFAM API response helpers.
 *
 * Role:
 * - Defines the standard success response envelope.
 * - Keeps controller responses consistent across all modules.
 * - Prevents repeated response-shaping code in controllers.
 *
 * Important:
 * - Controllers should use this helper for successful responses.
 * - Services should return data only, not HTTP response envelopes.
 * - Error response formatting remains owned by GlobalExceptionFilter.
 */

export interface ApiSuccessResponse<TData> {
  readonly status: number;
  readonly message: string;
  readonly data: TData;
  readonly timestamp_ms: number;
}

export interface CreateApiSuccessResponseOptions<TData> {
  readonly status: number;
  readonly message: string;
  readonly data: TData;
  readonly timestampMs?: number;
}

export function createApiSuccessResponse<TData>(
  options: CreateApiSuccessResponseOptions<TData>,
): ApiSuccessResponse<TData> {
  return {
    status: options.status,
    message: options.message,
    data: options.data,
    timestamp_ms: options.timestampMs ?? Date.now(),
  };
}
