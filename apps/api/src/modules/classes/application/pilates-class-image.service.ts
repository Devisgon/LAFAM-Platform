// apps/api/src/modules/classes/application/pilates-class-image.service.ts
/**
 * LAFAM Pilates class image service.
 *
 * Role:
 * - Owns Pilates class image validation.
 * - Owns Pilates class image upload to Supabase Storage.
 * - Owns Pilates class image deletion from Supabase Storage.
 * - Owns public URL generation for class images.
 *
 * Important:
 * - This service does not expose upload endpoints.
 * - Controllers receive multipart files and pass them into admin services.
 * - Admin services decide when an image should be uploaded, replaced, removed, or ignored.
 * - pilates_classes.image_path stores only the internal storage object path.
 * - Public/admin responses derive image_url from image_path.
 * - Frontend must never send image_path directly.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type { LAFAMSupabaseClient } from '../../../database/database.types';
import {
  PILATES_CLASS_IMAGE_ALLOWED_MIME_TYPES,
  PILATES_CLASS_IMAGE_BUCKET_ENV_KEY,
  PILATES_CLASS_IMAGE_DEFAULT_BUCKET,
  PILATES_CLASS_IMAGE_FIELD_NAME,
  PILATES_CLASS_IMAGE_FILE_BASENAME,
  PILATES_CLASS_IMAGE_MAX_SIZE_BYTES,
  PILATES_CLASS_IMAGE_STORAGE_ROOT,
  isPilatesClassImageMimeType,
  resolvePilatesClassImageExtension,
  type PilatesClassImageMimeType,
} from '../constants/pilates-class.constants';
import type {
  PilatesClassId,
  PilatesClassImageUploadFile,
  PilatesClassImageUploadResult,
} from '../types/pilates-class.types';

interface UploadPilatesClassImageInput {
  readonly classId: PilatesClassId;
  readonly file: PilatesClassImageUploadFile;
}

type ValidatedPilatesClassImageUploadFile = Omit<
  PilatesClassImageUploadFile,
  'mimetype'
> & {
  readonly mimetype: PilatesClassImageMimeType;
};

function resolveBucketName(): string {
  const configuredBucketName =
    process.env[PILATES_CLASS_IMAGE_BUCKET_ENV_KEY]?.trim();

  if (configuredBucketName) {
    return configuredBucketName;
  }

  return PILATES_CLASS_IMAGE_DEFAULT_BUCKET;
}

function assertImageFileExists(
  file: PilatesClassImageUploadFile | null,
): asserts file is PilatesClassImageUploadFile {
  if (!file) {
    throw AppError.pilatesClassImageRequired(
      'Pilates class image file is required.',
      {
        field: PILATES_CLASS_IMAGE_FIELD_NAME,
      },
    );
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw AppError.pilatesClassImageRequired(
      'Pilates class image file is empty.',
      {
        field: PILATES_CLASS_IMAGE_FIELD_NAME,
      },
    );
  }
}

function assertImageMimeTypeAllowed(
  mimetype: string,
): asserts mimetype is PilatesClassImageMimeType {
  if (isPilatesClassImageMimeType(mimetype)) {
    return;
  }

  throw AppError.pilatesClassImageInvalidFileType(
    'The Pilates class image file type is not supported.',
    {
      field: PILATES_CLASS_IMAGE_FIELD_NAME,
      allowed_mime_types: PILATES_CLASS_IMAGE_ALLOWED_MIME_TYPES,
      received_mime_type: mimetype,
    },
  );
}

function assertImageSizeAllowed(size: number): void {
  if (size <= PILATES_CLASS_IMAGE_MAX_SIZE_BYTES) {
    return;
  }

  throw AppError.pilatesClassImageFileTooLarge(
    'The Pilates class image file is too large.',
    {
      field: PILATES_CLASS_IMAGE_FIELD_NAME,
      max_size_bytes: PILATES_CLASS_IMAGE_MAX_SIZE_BYTES,
      received_size_bytes: size,
    },
  );
}

function validateImageFile(
  file: PilatesClassImageUploadFile | null,
): ValidatedPilatesClassImageUploadFile {
  assertImageFileExists(file);

  const mimetype = file.mimetype;

  assertImageMimeTypeAllowed(mimetype);
  assertImageSizeAllowed(file.size);

  return {
    ...file,
    mimetype,
  };
}

function validateOptionalImageFile(
  file: PilatesClassImageUploadFile | null,
): ValidatedPilatesClassImageUploadFile | null {
  if (!file) {
    return null;
  }

  return validateImageFile(file);
}

function buildClassImagePath(input: {
  readonly classId: PilatesClassId;
  readonly mimetype: PilatesClassImageMimeType;
}): string {
  const extension = resolvePilatesClassImageExtension(input.mimetype);

  return `${PILATES_CLASS_IMAGE_STORAGE_ROOT}/${input.classId}/${PILATES_CLASS_IMAGE_FILE_BASENAME}.${extension}`;
}

@Injectable()
export class PilatesClassImageService {
  private readonly bucketName = resolveBucketName();

  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  validateOptionalImageFile(
    file: PilatesClassImageUploadFile | null,
  ): PilatesClassImageUploadFile | null {
    return validateOptionalImageFile(file);
  }

  async uploadClassImage(
    input: UploadPilatesClassImageInput,
  ): Promise<PilatesClassImageUploadResult> {
    const imageFile = validateImageFile(input.file);
    const imagePath = buildClassImagePath({
      classId: input.classId,
      mimetype: imageFile.mimetype,
    });

    const { error } = await this.adminClient.storage
      .from(this.bucketName)
      .upload(imagePath, imageFile.buffer, {
        contentType: imageFile.mimetype,
        upsert: true,
      });

    if (error) {
      throw AppError.pilatesClassImageUploadFailed(error);
    }

    return {
      image_path: imagePath,
      image_url: this.resolvePublicImageUrl(imagePath),
    };
  }

  async deleteClassImage(imagePath: string | null): Promise<void> {
    if (!imagePath) {
      return;
    }

    const { error } = await this.adminClient.storage
      .from(this.bucketName)
      .remove([imagePath]);

    if (error) {
      throw AppError.pilatesClassImageDeleteFailed(error);
    }
  }

  resolvePublicImageUrl(imagePath: string): string;
  resolvePublicImageUrl(imagePath: null): null;
  resolvePublicImageUrl(imagePath: string | null): string | null {
    if (!imagePath) {
      return null;
    }

    const { data } = this.adminClient.storage
      .from(this.bucketName)
      .getPublicUrl(imagePath);

    return data.publicUrl;
  }
}
