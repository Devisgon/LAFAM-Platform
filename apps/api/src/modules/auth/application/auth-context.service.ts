// apps/api/src/modules/auth/application/auth-context.service.ts
/**
 * LAFAM Auth context service.
 *
 * Role:
 * - Owns authenticated frontend bootstrapping context.
 * - Returns the current user, session, permissions, and access flags.
 * - Writes an audit event when Auth context is resolved.
 *
 * Important:
 * - AuthGuard must resolve and attach Auth context before this service is used.
 * - ActiveSessionGuard must reject revoked, expired, deleted, deactivated, or invalid guest sessions before controller access.
 * - Frontend access flags are usability helpers only.
 * - Backend guards/services remain the final authorization authority.
 */

import { Injectable } from '@nestjs/common';

import { AUTH_AUDIT_EVENT_AUTH_CONTEXT_RESOLVED } from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import { mapAuthInternalContextToContextData } from '../types/auth-context.types';
import type { AuthContextResponse } from '../types/auth-response.types';

@Injectable()
export class AuthContextService {
  constructor(private readonly authAuditRepository: AuthAuditRepository) {}

  async getAuthContext(
    auth: AuthInternalContext,
  ): Promise<AuthContextResponse> {
    const context = mapAuthInternalContextToContextData(auth);

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_AUTH_CONTEXT_RESOLVED,
      ipAddress: auth.request.ipAddress,
      userAgent: auth.request.userAgent,
      metadata: {
        user_id: auth.profile.id,
        session_id: auth.session.id,
        role: auth.profile.role,
        status: auth.profile.status,
        is_guest: auth.profile.isGuest,
        permissions_count: context.permissions.length,
        can_access_admin_dashboard: context.access.can_access_admin_dashboard,
        can_access_staff_dashboard: context.access.can_access_staff_dashboard,
        requires_email_verification: context.access.requires_email_verification,
        requires_guest_conversion: context.access.requires_guest_conversion,
      },
    });

    return {
      context,
    };
  }
}
