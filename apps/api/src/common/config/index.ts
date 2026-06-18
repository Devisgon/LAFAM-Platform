// apps/api/src/common/config/index.ts
/**
 * LAFAM API config barrel.
 *
 * Role:
 * - Exports the approved configuration contract, validation, and config factories.
 * - Gives application modules one stable import path for common config.
 *
 * Important:
 * - Importing current* config constants triggers environment validation.
 * - Files that only need types should use type-only imports where possible.
 */

export * from './environment.contract';
export * from './env.validation';
export * from './auth.config';
export * from './payment.config';
export * from './app.config';
export * from './api.config';
export * from './cors.config';
export * from './database.config';
export * from './docs.config';
export * from './logging.config';
export * from './security.config';
export * from './supabase.config';
