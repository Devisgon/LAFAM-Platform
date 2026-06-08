// apps/api/src/common/bootstrap/apply-http-app-baseline.ts
/**
 * LAFAM API HTTP application baseline.
 *
 * Role:
 * - Applies global HTTP concerns to the NestJS app.
 * - Keeps main.ts thin and focused on application startup.
 * - Centralizes CORS, API prefixing, validation, security headers, logging, and exception handling.
 *
 * Important:
 * - This file does not create the Nest application.
 * - This file does not start the HTTP server.
 * - This file does not configure Swagger UI.
 * - Swagger is still initialized in main.ts because it needs the parsed swagger.yaml document.
 */

import { ValidationPipe, type INestApplication } from '@nestjs/common';

import { currentApiConfig, type ApiConfig } from '../config/api.config';
import {
  createNestCorsOptions,
  currentCorsConfig,
  type CorsConfig,
} from '../config/cors.config';
import { currentDocsConfig, type DocsConfig } from '../config/docs.config';
import {
  currentLoggingConfig,
  type LoggingConfig,
} from '../config/logging.config';
import {
  currentSecurityConfig,
  type SecurityConfig,
} from '../config/security.config';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { RequestLoggingInterceptor } from '../interceptors/request-logging.interceptor';
import { AppLoggerService } from '../logging/app-logger.service';
import { applyHttpSecurity } from '../security/http-security';

export interface HttpAppBaselineResult {
  readonly logger: AppLoggerService;
  readonly currentApiConfig: ApiConfig;
  readonly currentCorsConfig: CorsConfig;
  readonly currentDocsConfig: DocsConfig;
  readonly currentLoggingConfig: LoggingConfig;
  readonly currentSecurityConfig: SecurityConfig;
}

function applyApiPrefix(app: INestApplication, apiConfig: ApiConfig): void {
  if (apiConfig.prefix.length === 0) {
    return;
  }

  app.setGlobalPrefix(apiConfig.prefix);
}

function applyGlobalValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
}

function applyGlobalErrorHandling(
  app: INestApplication,
  logger: AppLoggerService,
): void {
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
}

function applyGlobalRequestLogging(
  app: INestApplication,
  logger: AppLoggerService,
): void {
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
}

export function applyHttpAppBaseline(
  app: INestApplication,
): HttpAppBaselineResult {
  const logger = new AppLoggerService();

  app.useLogger(logger);

  applyApiPrefix(app, currentApiConfig);

  app.enableCors(createNestCorsOptions(currentCorsConfig));

  applyHttpSecurity(app, currentSecurityConfig);

  applyGlobalValidation(app);

  applyGlobalErrorHandling(app, logger);

  applyGlobalRequestLogging(app, logger);

  app.enableShutdownHooks();

  return {
    logger,
    currentApiConfig,
    currentCorsConfig,
    currentDocsConfig,
    currentLoggingConfig,
    currentSecurityConfig,
  };
}
