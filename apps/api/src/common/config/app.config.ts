// apps/api/src/common/config/app.config.ts
/**
 * LAFAM API application config.
 *
 * Role:
 * - Exposes application-level runtime configuration.
 * - Converts the validated environment into a smaller app config object.
 * - Keeps process.env access outside business modules.
 *
 * Important:
 * - This file does not validate raw environment values directly.
 * - Validation is owned by env.validation.ts.
 * - Other modules should consume this config shape instead of reading process.env.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';
import type { NodeEnvironment } from './environment.contract';

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly isStaging: boolean;
  readonly isProduction: boolean;
  readonly port: number;
  readonly apiGlobalPrefix: string;
  readonly webOrigin: string;
  readonly webOrigins: readonly string[];
}

function parseWebOrigins(webOrigin: string): readonly string[] {
  return webOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function createAppConfig(
  environment: EnvironmentInput = process.env,
): AppConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { app } = validatedEnvironment;

  return {
    nodeEnv: app.nodeEnv,
    isDevelopment: app.nodeEnv === 'development',
    isTest: app.nodeEnv === 'test',
    isStaging: app.nodeEnv === 'staging',
    isProduction: app.nodeEnv === 'production',
    port: app.port,
    apiGlobalPrefix: app.apiGlobalPrefix,
    webOrigin: app.webOrigin,
    webOrigins: parseWebOrigins(app.webOrigin),
  };
}

export const currentAppConfig = createAppConfig();
