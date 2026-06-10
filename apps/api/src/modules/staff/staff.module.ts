// apps/api/src/modules/staff/staff.module.ts
/**
 * LAFAM Staff module.
 *
 * Role:
 * - Registers Staff Module controller, service, and repository.
 * - Provides the admin Staff API boundary.
 * - Connects Staff business logic to Supabase Auth through SupabaseAuthRepository.
 *
 * Important:
 * - StaffModule owns staff_profiles and staff_availability_rules access through StaffRepository.
 * - StaffModule does not expose Supabase clients to controllers.
 * - Staff Auth user creation is delegated to SupabaseAuthRepository.
 * - AuthModule is imported for guards/decorators/session enforcement used by Staff controllers.
 * - SupabaseAuthRepository is registered here because AuthModule does not export that repository directly.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { StaffAdminService } from './application/staff-admin.service';
import { StaffAdminController } from './controllers/staff-admin.controller';
import { StaffRepository } from './repositories/staff.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [StaffAdminController],
  providers: [StaffAdminService, StaffRepository],
  exports: [StaffAdminService, StaffRepository],
})
export class StaffModule {}
