// apps/api/src/common/config/security.config.ts
/**
 * LAFAM API security configuration.
 *
 * Role:
 * - Defines API-wide security behavior.
 * - Centralizes request body limits, JWT timing tolerance, and HTTP security defaults.
 * - Gives bootstrap, guards, and future auth services one stable security config source.
 *
 * Important:
 * - This file does not read process.env directly.
 * - Raw environment validation is owned by env.validation.ts.
 * - This file does not verify JWTs by itself.
 * - Auth verification belongs in the Auth module.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';

export interface SecurityHeaderConfig {
  readonly hidePoweredBy: boolean;
  readonly trustProxy: boolean;
  readonly contentTypeNosniff: boolean;
  readonly frameDeny: boolean;
  readonly referrerPolicy: string;
}

export interface AuthSecurityConfig {
  readonly authorizationHeaderName: string;
  readonly bearerTokenPrefix: string;
  readonly jwtClockToleranceSeconds: number;
}

export interface RequestSecurityConfig {
  readonly bodyLimit: string;
}

export interface SecurityConfig {
  readonly headers: SecurityHeaderConfig;
  readonly auth: AuthSecurityConfig;
  readonly request: RequestSecurityConfig;
}

const DEFAULT_AUTHORIZATION_HEADER_NAME = 'authorization';
const DEFAULT_BEARER_TOKEN_PREFIX = 'Bearer';

export function createSecurityConfig(
  environment: EnvironmentInput = process.env,
): SecurityConfig {
  const validatedEnvironment = validateEnvironment(environment);

  return {
    headers: {
      hidePoweredBy: true,
      trustProxy: true,
      contentTypeNosniff: true,
      frameDeny: true,
      referrerPolicy: 'no-referrer',
    },
    auth: {
      authorizationHeaderName: DEFAULT_AUTHORIZATION_HEADER_NAME,
      bearerTokenPrefix: DEFAULT_BEARER_TOKEN_PREFIX,
      jwtClockToleranceSeconds:
        validatedEnvironment.security.jwtClockToleranceSeconds,
    },
    request: {
      bodyLimit: validatedEnvironment.security.requestBodyLimit,
    },
  };
}

export const currentSecurityConfig = createSecurityConfig();
