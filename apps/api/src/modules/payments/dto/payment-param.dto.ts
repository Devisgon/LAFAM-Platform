// apps/api/src/modules/payments/dto/payment-param.dto.ts
/**
 * LAFAM Payment route parameter DTOs.
 *
 * Role:
 * - Validates Payment Module route parameters.
 * - Protects customer/admin payment routes from malformed object identifiers.
 * - Keeps paymentId, userId, walletAccountId, and ledgerEntryId validation consistent.
 *
 * Important:
 * - UUID validation is not authorization.
 * - Services/policies must still enforce ownership and admin access.
 * - Customer routes must never trust a valid UUID as proof of access.
 * - Admin wallet adjustment routes must still require audit reason and admin role.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsUUID } from 'class-validator';

function trimmedParam(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export class PaymentParamDto {
  @ApiProperty({
    description: 'Payment identifier.',
    example: '2a3417a5-6427-47e4-b412-587f3e1ebfd0',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'paymentId must be a valid UUID.',
  })
  readonly paymentId!: string;
}

export class PaymentTransactionParamDto {
  @ApiProperty({
    description: 'Payment transaction identifier.',
    example: 'b9f7720c-dc61-42d0-9c25-2fefcfae8a67',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'transactionId must be a valid UUID.',
  })
  readonly transactionId!: string;
}

export class WalletUserParamDto {
  @ApiProperty({
    description:
      'Application user identifier whose wallet is being read or adjusted by an admin.',
    example: '302d9725-1dd4-460c-b6aa-e42b5e429fb8',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'userId must be a valid UUID.',
  })
  readonly userId!: string;
}

export class WalletAccountParamDto {
  @ApiProperty({
    description: 'Wallet account identifier.',
    example: '38142cfa-2c40-4210-ad2a-e186a4259030',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'walletAccountId must be a valid UUID.',
  })
  readonly walletAccountId!: string;
}

export class WalletLedgerEntryParamDto {
  @ApiProperty({
    description: 'Wallet ledger entry identifier.',
    example: 'ab6395e8-5a65-486e-8310-05bc6d52916a',
    format: 'uuid',
  })
  @Transform(trimmedParam)
  @IsUUID('4', {
    message: 'ledgerEntryId must be a valid UUID.',
  })
  readonly ledgerEntryId!: string;
}
