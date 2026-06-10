// apps/api/src/modules/auth/dto/change-password.dto.ts
/**
 * LAFAM Auth change-password DTO.
 *
 * Role:
 * - Validates authenticated change-password request payloads.
 * - Requires current password, new password, and password confirmation.
 * - Keeps password values unchanged because passwords must not be trimmed or mutated.
 *
 * Important:
 * - This DTO does not verify the current password.
 * - This DTO does not enforce password policy beyond basic field bounds.
 * - The Auth profile service must validate current password and apply full password policy.
 */

import { IsString, MaxLength, MinLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';

export class ChangePasswordDto {
  @IsString({ message: 'current_password must be a string.' })
  @MinLength(1, {
    message: 'current_password is required.',
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `current_password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly current_password!: string;

  @IsString({ message: 'password must be a string.' })
  @MinLength(AUTH_FIELD_LIMITS.passwordMinLength, {
    message: `password must be at least ${AUTH_FIELD_LIMITS.passwordMinLength} characters long.`,
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly password!: string;

  @IsString({ message: 'confirm_password must be a string.' })
  @MinLength(AUTH_FIELD_LIMITS.passwordMinLength, {
    message: `confirm_password must be at least ${AUTH_FIELD_LIMITS.passwordMinLength} characters long.`,
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `confirm_password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly confirm_password!: string;
}
