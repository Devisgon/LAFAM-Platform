// apps/api/src/modules/auth/dto/refresh-token.dto.ts
/**
 * LAFAM Auth refresh-token DTO.
 *
 * Role:
 * - Validates refresh-token request payloads.
 * - Keeps refresh-token input intentionally minimal.
 * - Supports application-level session lookup by hashed refresh token.
 *
 * Important:
 * - Refresh tokens must not be trimmed by services after validation.
 * - Raw refresh tokens must never be stored or logged.
 * - The Auth service must hash the refresh token before repository lookup.
 */

import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'refresh_token must be a string.' })
  @MinLength(1, {
    message: 'refresh_token is required.',
  })
  @MaxLength(4096, {
    message: 'refresh_token must be at most 4096 characters long.',
  })
  readonly refresh_token!: string;
}
