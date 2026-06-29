// apps/api/src/modules/customers/customers.module.ts
/**
 * LAFAM Customers module.
 *
 * Role:
 * - Registers Customer Module controllers, services, repositories, and invite flow.
 * - Provides the protected admin Customer API boundary.
 * - Provides the public customer invitation acceptance API boundary.
 * - Connects Customer business logic to Auth-owned provider/user/audit infrastructure.
 * - Connects customer invite and welcome-email flows to NotificationsModule.
 *
 * Important:
 * - CustomersModule owns customer_profiles and customer_invitations access.
 * - Customer email, phone, role, auth status, and provider identity stay in app_users/Supabase Auth.
 * - Customer Civil ID stays in customer_profiles and must not be logged.
 * - Raw invite tokens must never be stored, logged, or exposed.
 * - AuthModule is imported for guards, Auth repositories, and protected admin route enforcement.
 * - NotificationsModule is imported for email outbox/template/provider orchestration.
 * - CustomerRepository is exported because Auth signup and guest conversion need customer profile creation.
 */

import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AuthAuditRepository } from '../auth/repositories/auth-audit.repository';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerAdminService } from './application/customer-admin.service';
import { CustomerInviteService } from './application/customer-invite.service';
import { CustomerAdminController } from './controllers/customer-admin.controller';
import { CustomerInvitePublicController } from './controllers/customer-invite-public.controller';
import { CustomerInviteRepository } from './repositories/customer-invite.repository';
import { CustomerRepository } from './repositories/customer.repository';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule), NotificationsModule],
  controllers: [CustomerAdminController, CustomerInvitePublicController],
  providers: [
    CustomerAdminService,
    CustomerInviteService,
    CustomerRepository,
    CustomerInviteRepository,
    AuthAuditRepository,
  ],
  exports: [CustomerAdminService, CustomerInviteService, CustomerRepository],
})
export class CustomersModule {}
