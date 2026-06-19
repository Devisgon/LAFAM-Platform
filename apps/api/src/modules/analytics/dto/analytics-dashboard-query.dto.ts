// apps/api/src/modules/analytics/dto/analytics-dashboard-query.dto.ts
/**
 * LAFAM Analytics dashboard query DTO.
 *
 * Role:
 * - Validates query parameters for the Admin Dashboard Analytics endpoint.
 * - Requires an explicit dashboard date range.
 * - Applies safe defaults for dashboard list limits and optional expensive
 *   sections.
 *
 * Important:
 * - This DTO validates query shape only.
 * - It does not query the database.
 * - It does not calculate metrics.
 * - It does not decide authorization.
 * - Date range-size validation belongs in the service layer.
 * - Revenue chart granularity is fixed to weekly for this module.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';

import {
  ANALYTICS_DEFAULT_RECENT_LIMIT,
  ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT,
  ANALYTICS_DEFAULT_UPCOMING_DAYS,
  ANALYTICS_ISO_DATE_PATTERN,
  ANALYTICS_MAX_RECENT_LIMIT,
  ANALYTICS_MAX_TOP_SERVICES_LIMIT,
  ANALYTICS_MAX_UPCOMING_DAYS,
} from '../constants/analytics.constants';

function normalizeRequiredDateString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function normalizeOptionalInteger({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return undefined;
  }

  const numericValue = Number(normalizedValue);

  return Number.isInteger(numericValue) ? numericValue : value;
}

function normalizeOptionalBoolean({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return value;
}

export class AnalyticsDashboardQueryDto {
  @ApiProperty({
    description:
      'Dashboard analytics start date. Format: YYYY-MM-DD. Used for revenue, booking, cancellation, customer, payment, wallet, and top-class metrics.',
    example: '2026-06-01',
    pattern: ANALYTICS_ISO_DATE_PATTERN.source,
  })
  @Transform(normalizeRequiredDateString)
  @IsString({
    message: 'from_date must be a string.',
  })
  @Matches(ANALYTICS_ISO_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date!: string;

  @ApiProperty({
    description:
      'Dashboard analytics end date. Format: YYYY-MM-DD. Used for revenue, booking, cancellation, customer, payment, wallet, and top-class metrics.',
    example: '2026-06-30',
    pattern: ANALYTICS_ISO_DATE_PATTERN.source,
  })
  @Transform(normalizeRequiredDateString)
  @IsString({
    message: 'to_date must be a string.',
  })
  @Matches(ANALYTICS_ISO_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date!: string;

  @ApiPropertyOptional({
    description:
      'Number of days from today to include in upcoming bookings and optional calendar events.',
    example: ANALYTICS_DEFAULT_UPCOMING_DAYS,
    default: ANALYTICS_DEFAULT_UPCOMING_DAYS,
    minimum: 1,
    maximum: ANALYTICS_MAX_UPCOMING_DAYS,
  })
  @Transform(normalizeOptionalInteger)
  @IsInt({
    message: 'upcoming_days must be an integer.',
  })
  @Min(1, {
    message: 'upcoming_days must be at least 1.',
  })
  @Max(ANALYTICS_MAX_UPCOMING_DAYS, {
    message: `upcoming_days must not exceed ${ANALYTICS_MAX_UPCOMING_DAYS}.`,
  })
  readonly upcoming_days: number = ANALYTICS_DEFAULT_UPCOMING_DAYS;

  @ApiPropertyOptional({
    description: 'Maximum number of recent booking feed items to return.',
    example: ANALYTICS_DEFAULT_RECENT_LIMIT,
    default: ANALYTICS_DEFAULT_RECENT_LIMIT,
    minimum: 1,
    maximum: ANALYTICS_MAX_RECENT_LIMIT,
  })
  @Transform(normalizeOptionalInteger)
  @IsInt({
    message: 'recent_limit must be an integer.',
  })
  @Min(1, {
    message: 'recent_limit must be at least 1.',
  })
  @Max(ANALYTICS_MAX_RECENT_LIMIT, {
    message: `recent_limit must not exceed ${ANALYTICS_MAX_RECENT_LIMIT}.`,
  })
  readonly recent_limit: number = ANALYTICS_DEFAULT_RECENT_LIMIT;

  @ApiPropertyOptional({
    description:
      'Maximum number of top Pilates classes to return. The frontend may label this section as Top Services.',
    example: ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT,
    default: ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT,
    minimum: 1,
    maximum: ANALYTICS_MAX_TOP_SERVICES_LIMIT,
  })
  @Transform(normalizeOptionalInteger)
  @IsInt({
    message: 'top_services_limit must be an integer.',
  })
  @Min(1, {
    message: 'top_services_limit must be at least 1.',
  })
  @Max(ANALYTICS_MAX_TOP_SERVICES_LIMIT, {
    message: `top_services_limit must not exceed ${ANALYTICS_MAX_TOP_SERVICES_LIMIT}.`,
  })
  readonly top_services_limit: number = ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT;

  @ApiPropertyOptional({
    description:
      'Whether wallet balance and wallet movement summary should be included. Disabled by default because it is not required for every dashboard load.',
    example: false,
    default: false,
  })
  @Transform(normalizeOptionalBoolean)
  @IsBoolean({
    message: 'include_wallet_summary must be a boolean.',
  })
  readonly include_wallet_summary: boolean = false;

  @ApiPropertyOptional({
    description:
      'Whether upcoming admin calendar events should be included. Disabled by default because the calendar module already has a dedicated endpoint.',
    example: false,
    default: false,
  })
  @Transform(normalizeOptionalBoolean)
  @IsBoolean({
    message: 'include_calendar_events must be a boolean.',
  })
  readonly include_calendar_events: boolean = false;
}
