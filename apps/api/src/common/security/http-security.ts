// apps/api/src/common/security/http-security.ts
/**
 * LAFAM API HTTP security helpers.
 *
 * Role:
 * - Applies basic HTTP hardening settings to the NestJS app.
 * - Adds safe default security headers.
 * - Disables framework fingerprint headers when supported by the HTTP adapter.
 * - Applies trusted proxy behavior when configured.
 *
 * Important:
 * - This is not authentication.
 * - This is not authorization.
 * - This only hardens HTTP responses at the transport/application boundary.
 * - Auth rules still belong in guards and Auth module services.
 */

import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  currentSecurityConfig,
  type SecurityConfig,
} from '../config/security.config';

interface HttpAdapterInstance {
  readonly disable?: (setting: string) => void;
  readonly set?: (setting: string, value: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpAdapterInstance(value: unknown): value is HttpAdapterInstance {
  if (!isRecord(value)) {
    return false;
  }

  const disable = value.disable;
  const set = value.set;

  return (
    (typeof disable === 'undefined' || typeof disable === 'function') &&
    (typeof set === 'undefined' || typeof set === 'function')
  );
}

function getHttpAdapterInstance(
  app: INestApplication,
): HttpAdapterInstance | null {
  const adapterInstance: unknown = app.getHttpAdapter().getInstance();

  return isHttpAdapterInstance(adapterInstance) ? adapterInstance : null;
}

function applyAdapterSecuritySettings(
  app: INestApplication,
  securityConfig: SecurityConfig,
): void {
  const adapterInstance = getHttpAdapterInstance(app);

  if (!adapterInstance) {
    return;
  }

  if (securityConfig.headers.hidePoweredBy) {
    adapterInstance.disable?.('x-powered-by');
  }

  if (securityConfig.headers.trustProxy) {
    adapterInstance.set?.('trust proxy', 1);
  }
}

function createSecurityHeadersMiddleware(securityConfig: SecurityConfig) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    if (securityConfig.headers.contentTypeNosniff) {
      response.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (securityConfig.headers.frameDeny) {
      response.setHeader('X-Frame-Options', 'DENY');
    }

    response.setHeader(
      'Referrer-Policy',
      securityConfig.headers.referrerPolicy,
    );
    response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  };
}

export function applyHttpSecurity(
  app: INestApplication,
  securityConfig: SecurityConfig = currentSecurityConfig,
): void {
  applyAdapterSecuritySettings(app, securityConfig);
  app.use(createSecurityHeadersMiddleware(securityConfig));
}
