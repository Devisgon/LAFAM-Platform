// apps/api/src/common/config/cors.config.ts
/**
 * LAFAM API CORS configuration.
 *
 * Role:
 * - Defines which frontend origins can call the API from browsers.
 * - Keeps CORS behavior centralized for the HTTP app baseline.
 * - Prevents open wildcard CORS in credentialed requests.
 *
 * Important:
 * - This file does not read process.env directly.
 * - Allowed origins come from app.config.ts after environment validation.
 * - Browser CORS is not authentication. Backend guards must still enforce access.
 */

import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

import { currentAppConfig } from './app.config';

export interface CorsConfig {
  readonly allowedOrigins: readonly string[];
  readonly credentials: boolean;
  readonly methods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly exposedHeaders: readonly string[];
  readonly maxAgeSeconds: number;
}

const DEFAULT_CORS_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

const DEFAULT_CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'Origin',
  'X-Requested-With',
] as const;

const DEFAULT_CORS_EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Type',
] as const;

const DEFAULT_CORS_MAX_AGE_SECONDS = 600;

function dedupeOrigins(origins: readonly string[]): readonly string[] {
  return Array.from(new Set(origins));
}

export function createCorsConfig(): CorsConfig {
  return {
    allowedOrigins: dedupeOrigins(currentAppConfig.webOrigins),
    credentials: true,
    methods: DEFAULT_CORS_METHODS,
    allowedHeaders: DEFAULT_CORS_ALLOWED_HEADERS,
    exposedHeaders: DEFAULT_CORS_EXPOSED_HEADERS,
    maxAgeSeconds: DEFAULT_CORS_MAX_AGE_SECONDS,
  };
}

export function createNestCorsOptions(
  corsConfig: CorsConfig = currentCorsConfig,
): CorsOptions {
  return {
    origin: [...corsConfig.allowedOrigins],
    credentials: corsConfig.credentials,
    methods: [...corsConfig.methods],
    allowedHeaders: [...corsConfig.allowedHeaders],
    exposedHeaders: [...corsConfig.exposedHeaders],
    maxAge: corsConfig.maxAgeSeconds,
  };
}

export const currentCorsConfig = createCorsConfig();
