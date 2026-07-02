import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsUUID } from 'class-validator';

function trimmedParam(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  return typeof value === 'string' ? value.trim() : value;
}

export class PromoCodeParamDto {
  @ApiProperty({
    description: 'Promo code identifier.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'promoCodeId must be a valid UUID.',
  })
  readonly promoCodeId!: string;
}
