import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

import {
  PRIVATE_BOOKING_ALLOWED_CURRENCIES,
  PRIVATE_BOOKING_DEFAULT_CURRENCY,
  PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT,
  PRIVATE_BOOKING_PRICE_AMOUNT_MIN,
  PRIVATE_BOOKING_PRICE_DECIMAL_PLACES,
} from '../constants/booking.constants';
import { CreatePrivateBookingDto } from './create-private-booking.dto';

function optionalDecimal({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class CreateAdminPrivateBookingDto extends CreatePrivateBookingDto {
  @ApiPropertyOptional({
    description: 'Price for this single private trainer booking.',
    example: 15,
    default: PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT,
    minimum: PRIVATE_BOOKING_PRICE_AMOUNT_MIN,
  })
  @Transform(optionalDecimal)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: PRIVATE_BOOKING_PRICE_DECIMAL_PLACES },
    {
      message: `price_amount must be a number with no more than ${PRIVATE_BOOKING_PRICE_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(PRIVATE_BOOKING_PRICE_AMOUNT_MIN, {
    message: `price_amount must be at least ${PRIVATE_BOOKING_PRICE_AMOUNT_MIN}.`,
  })
  readonly price_amount?: number = PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT;

  @ApiPropertyOptional({
    description: 'Booking currency. Current Payment Module supports KWD only.',
    enum: PRIVATE_BOOKING_ALLOWED_CURRENCIES,
    example: PRIVATE_BOOKING_DEFAULT_CURRENCY,
    default: PRIVATE_BOOKING_DEFAULT_CURRENCY,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PRIVATE_BOOKING_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency?: typeof PRIVATE_BOOKING_DEFAULT_CURRENCY =
    PRIVATE_BOOKING_DEFAULT_CURRENCY;
}
