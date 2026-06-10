// apps/api/src/modules/auth/auth.module.ts
/**
 * LAFAM Auth module.
 *
 * Role:
 * - Registers Auth controllers, services, repositories, and guards.
 * - Keeps Auth wiring isolated before root AppModule integration.
 * - Imports database/logging infrastructure required by Auth providers.
 *
 * Important:
 * - Do not import AuthModule into AppModule until this module compiles internally.
 * - Controllers stay thin and delegate to services.
 * - Services depend on repositories, not direct controller/database coupling.
 * - Guards are exported because later business modules need protected route enforcement.
 */

import { Module } from '@nestjs/common';

import { LoggingModule } from '../../common/logging/logging.module';
import { DatabaseModule } from '../../database/database.module';
import { AuthAdminService } from './application/auth-admin.service';
import { AuthContextService } from './application/auth-context.service';
import { AuthProfileService } from './application/auth-profile.service';
import { AuthSessionService } from './application/auth-session.service';
import { AuthService } from './application/auth.service';
import { AvatarService } from './application/avatar.service';
import { GuestConversionService } from './application/guest-conversion.service';
import { GuestSessionService } from './application/guest-session.service';
import { PasswordResetService } from './application/password-reset.service';
import { AuthAdminController } from './controllers/auth-admin.controller';
import { AuthContextController } from './controllers/auth-context.controller';
import { AuthGuestController } from './controllers/auth-guest.controller';
import { AuthProfileController } from './controllers/auth-profile.controller';
import { AuthPublicController } from './controllers/auth-public.controller';
import { AuthSessionController } from './controllers/auth-session.controller';
import { ActiveSessionGuard } from './guards/active-session.guard';
import { AuthGuard } from './guards/auth.guard';
import { GuestOnlyGuard } from './guards/guest-only.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthAuditRepository } from './repositories/auth-audit.repository';
import { AuthSessionRepository } from './repositories/auth-session.repository';
import { AuthUserRepository } from './repositories/auth-user.repository';
import { GuestSessionRepository } from './repositories/guest-session.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { SupabaseAuthRepository } from './repositories/supabase-auth.repository';

@Module({
  imports: [DatabaseModule, LoggingModule],
  controllers: [
    AuthPublicController,
    AuthGuestController,
    AuthSessionController,
    AuthProfileController,
    AuthAdminController,
    AuthContextController,
  ],
  providers: [
    AuthService,
    PasswordResetService,
    GuestSessionService,
    GuestConversionService,
    AuthSessionService,
    AuthProfileService,
    AvatarService,
    AuthAdminService,
    AuthContextService,
    SupabaseAuthRepository,
    AuthUserRepository,
    AuthSessionRepository,
    PasswordResetRepository,
    AuthAuditRepository,
    GuestSessionRepository,
    AuthGuard,
    ActiveSessionGuard,
    RolesGuard,
    GuestOnlyGuard,
  ],
  exports: [
    AuthService,
    AuthContextService,

    SupabaseAuthRepository,
    AuthUserRepository,
    AuthSessionRepository,
    GuestSessionService,

    AuthGuard,
    ActiveSessionGuard,
    RolesGuard,
    GuestOnlyGuard,
  ],
})
export class AuthModule {}
