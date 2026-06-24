// apps/api/src/modules/customers/customers.module.ts
/**
 * LAFAM Customers module.
 *
 * Role:
 * - Registers Customer Module controller, service, and repository.
 * - Provides the protected admin Customer API boundary.
 * - Connects Customer business logic to Auth-owned provider/user/audit infrastructure.
 *
 * Important:
 * - CustomersModule owns customer_profiles access through CustomerRepository.
 * - Customer email, phone, role, auth status, and provider identity stay in app_users/Supabase Auth.
 * - Customer Civil ID stays in customer_profiles and must not be logged.
 * - AuthModule is imported for guards, Auth repositories, and protected admin route enforcement.
 * - CustomerRepository is exported because Auth signup and guest conversion need customer profile creation.
 */

import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AuthAuditRepository } from '../auth/repositories/auth-audit.repository';
import { CustomerAdminService } from './application/customer-admin.service';
import { CustomerAdminController } from './controllers/customer-admin.controller';
import { CustomerRepository } from './repositories/customer.repository';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  controllers: [CustomerAdminController],
  providers: [CustomerAdminService, CustomerRepository, AuthAuditRepository],
  exports: [CustomerAdminService, CustomerRepository],
})
export class CustomersModule {}
