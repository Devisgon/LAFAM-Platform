// apps/api/src/common/config/docs.config.ts
/**
 * LAFAM API documentation configuration.
 *
 * Role:
 * - Defines Swagger/OpenAPI documentation paths.
 * - Defines where the approved swagger.yaml source-of-truth file can be found.
 * - Keeps Swagger setup values outside main.ts.
 *
 * Important:
 * - Swagger/OpenAPI contract source is docs/swagger.yaml.
 * - Runtime Swagger UI should serve the YAML contract, not generate a code-first contract.
 * - This file does not parse YAML. Parsing belongs in the bootstrap layer.
 */

import { resolve } from 'node:path';

import { currentApiConfig } from './api.config';

const DEFAULT_SWAGGER_UI_PATH = 'docs';
const DEFAULT_OPENAPI_JSON_PATH = 'openapi.json';
const DEFAULT_OPENAPI_YAML_FILE_NAME = 'swagger.yaml';

export interface DocsConfig {
  readonly enabled: boolean;
  readonly swaggerPath: string;
  readonly openApiJsonPath: string;
  readonly openApiYamlFileName: string;
  readonly swaggerUrl: string;
  readonly openApiJsonUrl: string;
  readonly swaggerYamlCandidatePaths: readonly string[];
}

function normalizePathSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function createAbsoluteRoute(path: string): string {
  const normalizedPath = normalizePathSegment(path);

  return normalizedPath.length > 0 ? `/${normalizedPath}` : '/';
}

function createDocsUrl(path: string): string {
  return `${currentApiConfig.localBaseUrl.replace(/\/+$/g, '')}${createAbsoluteRoute(path)}`;
}

function createSwaggerYamlCandidatePaths(): readonly string[] {
  return [
    resolve(process.cwd(), 'docs', DEFAULT_OPENAPI_YAML_FILE_NAME),
    resolve(
      process.cwd(),
      'apps',
      'api',
      'docs',
      DEFAULT_OPENAPI_YAML_FILE_NAME,
    ),
    resolve(__dirname, '..', 'docs', DEFAULT_OPENAPI_YAML_FILE_NAME),
  ];
}

export function createDocsConfig(): DocsConfig {
  const swaggerPath = normalizePathSegment(DEFAULT_SWAGGER_UI_PATH);
  const openApiJsonPath = normalizePathSegment(DEFAULT_OPENAPI_JSON_PATH);

  return {
    enabled: true,
    swaggerPath,
    openApiJsonPath,
    openApiYamlFileName: DEFAULT_OPENAPI_YAML_FILE_NAME,
    swaggerUrl: createDocsUrl(swaggerPath),
    openApiJsonUrl: createDocsUrl(openApiJsonPath),
    swaggerYamlCandidatePaths: createSwaggerYamlCandidatePaths(),
  };
}

export const currentDocsConfig = createDocsConfig();
