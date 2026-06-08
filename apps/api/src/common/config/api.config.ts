// apps/api/src/common/config/api.config.ts
/**
 * LAFAM API HTTP configuration.
 *
 * Role:
 * - Defines the HTTP server host, port, API prefix, and computed base URLs.
 * - Keeps HTTP bootstrap values outside main.ts.
 * - Gives apply-http-app-baseline.ts one clean config object to consume later.
 *
 * Important:
 * - This file does not read process.env directly.
 * - Environment reading and validation are owned by env.validation.ts.
 * - Application-level config is owned by app.config.ts.
 */

import { currentAppConfig } from './app.config';

const DEFAULT_API_HOST = '0.0.0.0';

export interface ApiConfig {
  readonly host: string;
  readonly port: number;
  readonly prefix: string;
  readonly basePath: string;
  readonly baseUrl: string;
  readonly localBaseUrl: string;
}

function normalizeApiPrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, '');
}

function createBasePath(prefix: string): string {
  const normalizedPrefix = normalizeApiPrefix(prefix);

  return normalizedPrefix.length > 0 ? `/${normalizedPrefix}` : '';
}

function createDisplayHost(host: string): string {
  return host === '0.0.0.0' ? 'localhost' : host;
}

function createBaseUrl(host: string, port: number, basePath: string): string {
  return `http://${host}:${port}${basePath}`;
}

export function createApiConfig(): ApiConfig {
  const prefix = normalizeApiPrefix(currentAppConfig.apiGlobalPrefix);
  const basePath = createBasePath(prefix);
  const displayHost = createDisplayHost(DEFAULT_API_HOST);

  return {
    host: DEFAULT_API_HOST,
    port: currentAppConfig.port,
    prefix,
    basePath,
    baseUrl: createBaseUrl(DEFAULT_API_HOST, currentAppConfig.port, basePath),
    localBaseUrl: createBaseUrl(displayHost, currentAppConfig.port, basePath),
  };
}

export const currentApiConfig = createApiConfig();
