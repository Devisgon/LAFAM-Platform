// apps/api/src/modules/staff/staff.module.ts
/**
 * LAFAM Staff module.
 *
 * Role:
 * - Registers Staff Module controller, service, and repository.
 * - Provides the admin Staff API boundary.
 * - Connects Staff business logic to Supabase Auth through AuthModule.
 * - Connects staff/trainer account and availability emails to NotificationsModule.
 *
 * Important:
 * - StaffModule owns staff_profiles and staff_availability_rules access through StaffRepository.
 * - StaffModule does not expose Supabase clients to controllers.
 * - Staff Auth user creation is delegated to SupabaseAuthRepository through the Auth module boundary.
 * - AuthModule is imported for guards/decorators/session enforcement and Auth repository access used by Staff services/controllers.
 * - NotificationsModule is imported for staff/trainer email outbox creation through EmailNotificationService.
 * - StaffModule must not call Brevo directly.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffAdminService } from './application/staff-admin.service';
import { StaffAdminController } from './controllers/staff-admin.controller';
import { StaffRepository } from './repositories/staff.repository';

@Module({
  imports: [DatabaseModule, AuthModule, NotificationsModule],
  controllers: [StaffAdminController],
  providers: [StaffAdminService, StaffRepository],
  exports: [StaffAdminService, StaffRepository],
})
export class StaffModule {}
