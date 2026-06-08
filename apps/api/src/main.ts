// apps/api/src/main.ts
/**
 * LAFAM API bootstrap entrypoint.
 *
 * Role:
 * - Loads local environment variables before application modules are imported.
 * - Creates the NestJS application instance.
 * - Applies the shared HTTP app baseline.
 * - Loads Swagger/OpenAPI from docs/swagger.yaml.
 * - Serves Swagger UI and OpenAPI JSON.
 * - Redirects / to /api.
 * - Redirects /docs and /docs/ to the prefixed Swagger route.
 * - Starts the HTTP server.
 *
 * Important:
 * - dotenv/config must stay as the first runtime import.
 * - HTTP concerns belong in apply-http-app-baseline.ts.
 * - Config values come from the approved common config layer.
 * - Swagger contract source remains docs/swagger.yaml.
 * - This file must stay thin.
 */

import 'dotenv/config';

import { existsSync, readFileSync } from 'node:fs';

import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import YAML from 'yaml';

import { AppModule } from './app.module';
import { applyHttpAppBaseline } from './common/bootstrap/apply-http-app-baseline';
import { AppLoggerService } from './common/logging/app-logger.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOpenApiDocument(value: unknown): value is OpenAPIObject {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.openapi === 'string' &&
    isRecord(value.info) &&
    isRecord(value.paths)
  );
}

function findSwaggerYamlPath(candidatePaths: readonly string[]): string {
  const matchedPath = candidatePaths.find((candidatePath) =>
    existsSync(candidatePath),
  );

  if (!matchedPath) {
    throw new Error(
      `Swagger YAML file not found. Checked paths: ${candidatePaths.join(', ')}`,
    );
  }

  return matchedPath;
}

function loadSwaggerDocument(candidatePaths: readonly string[]): OpenAPIObject {
  const swaggerYamlPath = findSwaggerYamlPath(candidatePaths);
  const swaggerYamlContent = readFileSync(swaggerYamlPath, 'utf8');
  const parsedDocument: unknown = YAML.parse(swaggerYamlContent);

  if (!isOpenApiDocument(parsedDocument)) {
    throw new Error(
      'Swagger YAML is not a valid OpenAPI document. Required fields: openapi, info, paths.',
    );
  }

  return parsedDocument;
}

function joinRouteSegments(...segments: readonly string[]): string {
  return segments
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0)
    .join('/');
}

function createAbsoluteRoute(routePath: string): string {
  const normalizedRoutePath = routePath.trim().replace(/^\/+|\/+$/g, '');

  return normalizedRoutePath.length > 0 ? `/${normalizedRoutePath}` : '/';
}

function applyRootRedirect(
  app: { use: (...args: unknown[]) => void },
  targetPath: string,
): void {
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestPath = request.originalUrl || request.url;

    if (request.method === 'GET' && requestPath === '/') {
      response.redirect(302, targetPath);
      return;
    }

    next();
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: false,
  });

  const { logger, currentApiConfig, currentDocsConfig } =
    applyHttpAppBaseline(app);

  const swaggerDocument = loadSwaggerDocument(
    currentDocsConfig.swaggerYamlCandidatePaths,
  );

  const swaggerRoutePath = joinRouteSegments(
    currentApiConfig.prefix,
    currentDocsConfig.swaggerPath,
  );

  const openApiJsonRoutePath = joinRouteSegments(
    currentApiConfig.prefix,
    currentDocsConfig.openApiJsonPath,
  );

  const absoluteSwaggerRoutePath = createAbsoluteRoute(swaggerRoutePath);
  const absoluteOpenApiJsonRoutePath =
    createAbsoluteRoute(openApiJsonRoutePath);
  const absoluteApiRootPath = createAbsoluteRoute(currentApiConfig.prefix);

  applyRootRedirect(app, absoluteApiRootPath);

  app.use(['/docs', '/docs/'], (_request: Request, response: Response) => {
    response.redirect(302, absoluteSwaggerRoutePath);
  });

  SwaggerModule.setup(swaggerRoutePath, app, swaggerDocument, {
    ui: true,
    raw: ['json'],
    jsonDocumentUrl: absoluteOpenApiJsonRoutePath,
    swaggerUrl: absoluteOpenApiJsonRoutePath,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(currentApiConfig.port, currentApiConfig.host);

  logger.log('LAFAM API started.', {
    context: 'Bootstrap',
    metadata: {
      baseUrl: currentApiConfig.localBaseUrl,
      host: currentApiConfig.host,
      port: currentApiConfig.port,
      apiPrefix: currentApiConfig.prefix,
      rootRedirectFrom: '/',
      rootRedirectTo: absoluteApiRootPath,
    },
  });

  logger.log('Swagger UI started.', {
    context: 'Bootstrap',
    metadata: {
      swaggerUrl: currentDocsConfig.swaggerUrl,
      openApiJsonUrl: currentDocsConfig.openApiJsonUrl,
      redirectFrom: '/docs',
      redirectTo: absoluteSwaggerRoutePath,
    },
  });
}

bootstrap().catch((error: unknown) => {
  const fallbackLogger = new AppLoggerService();

  fallbackLogger.error('Failed to start LAFAM API.', {
    context: 'Bootstrap',
    metadata: {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
    },
    trace: error instanceof Error ? error.stack : undefined,
  });

  process.exit(1);
});
