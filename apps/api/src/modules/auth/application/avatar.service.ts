// apps/api/src/modules/auth/application/avatar.service.ts
/**
 * LAFAM Auth avatar service.
 *
 * Role:
 * - Owns authenticated avatar upload.
 * - Owns authenticated avatar URL lookup.
 * - Validates avatar MIME type and file size.
 * - Stores avatar files in the configured Supabase Storage bucket.
 * - Persists the avatar_path on app_users.
 *
 * Important:
 * - AuthGuard must resolve and attach Auth context before this service is used.
 * - ActiveSessionGuard must reject revoked/expired/deleted/deactivated sessions before controller access.
 * - Guest users cannot upload avatars.
 * - This service never logs or returns storage internals, Supabase keys, or raw provider errors.
 */

import { Inject, Injectable } from '@nestjs/common';

import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import { AUTH_AUDIT_EVENT_AVATAR_UPLOADED } from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthAvatarResponse,
  AuthAvatarUploadResponse,
} from '../types/auth-response.types';

export interface AuthAvatarServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuthAvatarUploadFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
  readonly originalname?: string;
}

const EMPTY_REQUEST_METADATA: AuthAvatarServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

const AVATAR_FILE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function assertNotGuestProfile(auth: AuthInternalContext): void {
  if (!auth.profile.isGuest) {
    return;
  }

  throw AppError.guestCannotAccessResource(
    'Guest users must create an account before uploading an avatar.',
  );
}

function assertAvatarFileExists(
  file: AuthAvatarUploadFile | null,
): asserts file is AuthAvatarUploadFile {
  if (!file) {
    throw AppError.validationFailed('Avatar file is required.', {
      field: 'avatar',
    });
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw AppError.validationFailed('Avatar file is empty.', {
      field: 'avatar',
    });
  }
}

function assertAvatarMimeTypeAllowed(mimetype: string): void {
  if (currentAuthConfig.avatar.allowedMimeTypes.includes(mimetype)) {
    return;
  }

  throw AppError.avatarInvalidFileType(
    'The avatar file type is not supported.',
    {
      allowed_mime_types: currentAuthConfig.avatar.allowedMimeTypes,
    },
  );
}

function assertAvatarSizeAllowed(size: number): void {
  if (size <= currentAuthConfig.avatar.maxSizeBytes) {
    return;
  }

  throw AppError.avatarFileTooLarge('The avatar file is too large.', {
    max_size_bytes: currentAuthConfig.avatar.maxSizeBytes,
  });
}

function resolveAvatarFileExtension(mimetype: string): string {
  return AVATAR_FILE_EXTENSION_BY_MIME_TYPE[mimetype] ?? 'bin';
}

function buildAvatarPath(input: {
  readonly userId: string;
  readonly mimetype: string;
}): string {
  const extension = resolveAvatarFileExtension(input.mimetype);

  return `users/${input.userId}/avatar.${extension}`;
}

function validateAvatarFile(
  file: AuthAvatarUploadFile | null,
): AuthAvatarUploadFile {
  assertAvatarFileExists(file);
  assertAvatarMimeTypeAllowed(file.mimetype);
  assertAvatarSizeAllowed(file.size);

  return file;
}

@Injectable()
export class AvatarService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async uploadAvatar(
    auth: AuthInternalContext,
    file: AuthAvatarUploadFile | null,
    request: AuthAvatarServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthAvatarUploadResponse> {
    assertNotGuestProfile(auth);

    const avatarFile = validateAvatarFile(file);
    const avatarPath = buildAvatarPath({
      userId: auth.profile.id,
      mimetype: avatarFile.mimetype,
    });

    await this.uploadAvatarFile({
      path: avatarPath,
      file: avatarFile,
    });

    await this.updateUserAvatarPath({
      userId: auth.profile.id,
      avatarPath,
    });

    const avatarUrl = await this.createAvatarSignedUrl(avatarPath);

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_AVATAR_UPLOADED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        avatar_path: avatarPath,
        mime_type: avatarFile.mimetype,
        size_bytes: avatarFile.size,
      },
    });

    return {
      avatar_path: avatarPath,
      avatar_url: avatarUrl,
    };
  }

  async getAvatar(auth: AuthInternalContext): Promise<AuthAvatarResponse> {
    if (!auth.profile.avatarPath) {
      return {
        avatar_path: null,
        avatar_url: null,
      };
    }

    return {
      avatar_path: auth.profile.avatarPath,
      avatar_url: await this.createAvatarSignedUrl(auth.profile.avatarPath),
    };
  }

  private async uploadAvatarFile(input: {
    readonly path: string;
    readonly file: AuthAvatarUploadFile;
  }): Promise<void> {
    const { error } = await this.adminClient.storage
      .from(currentAuthConfig.avatar.bucket)
      .upload(input.path, input.file.buffer, {
        contentType: input.file.mimetype,
        upsert: true,
      });

    if (error) {
      throw AppError.avatarUploadFailed(error);
    }
  }

  private async updateUserAvatarPath(input: {
    readonly userId: string;
    readonly avatarPath: string;
  }): Promise<void> {
    const updatePayload: AppUserUpdate = {
      avatar_path: input.avatarPath,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw AppError.avatarUploadFailed(error);
    }

    if (!data) {
      throw AppError.userNotFound('The current user was not found.', {
        user_id: input.userId,
      });
    }
  }

  private async createAvatarSignedUrl(avatarPath: string): Promise<string> {
    const { data, error } = await this.adminClient.storage
      .from(currentAuthConfig.avatar.bucket)
      .createSignedUrl(
        avatarPath,
        currentAuthConfig.avatar.signedUrlTtlSeconds,
      );

    if (error || !data?.signedUrl) {
      throw AppError.avatarUploadFailed(error);
    }

    return data.signedUrl;
  }
}
