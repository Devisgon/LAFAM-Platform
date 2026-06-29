Replace the full file:

```text id="7pcywy"
README.md
```

<div align="center">
  <div style="display: inline-block; padding: 16px 24px; background: #ffffff; border-radius: 24px;">
    <img src="apps/web/public/logo.svg" alt="LAFAM logo" width="180" />
  </div>
</div>

# LAFAM Platform

LAFAM Platform is a single-tenant admin dashboard and backend platform for the LAFAM Pilates and ladies salon booking product.

The current sprint is focused on the **Admin Dashboard MVP** and the backend foundation for the Pilates-first release. The mobile application, production KNET settlement, advanced wallet/loyalty logic, advanced salon scheduling, and multi-tenant SaaS behavior are outside the current sprint unless explicitly approved later.

## Current Status

This repository is no longer a starter scaffold.

Current implemented areas include:

- NestJS API foundation with global HTTP baseline, validation, request logging, exception handling, Swagger loading, and health routes
- Supabase-backed Auth module with customer accounts, guest sessions, profile management, avatar support, sessions, password reset, and admin user management
- Customer admin management
- Customer invitation creation, resend, revoke, and public acceptance flow
- Notification foundation with email outbox, delivery attempts, template rendering, Brevo provider boundary, idempotency, recipient routing, and safe metadata rules
- Staff and trainer management with availability rules
- Pilates class definitions and scheduled Pilates occurrences
- Recurring Pilates schedule generation
- Multi-time schedule slots
- Pilates booking lifecycle with database-backed atomic booking operations
- FIFO waitlist foundation
- Private trainer bookings
- Admin booking calendar
- Payment module with backend-owned pricing, hosted payment boundary, mock/KNET provider boundary, callbacks, webhooks, transactions, refunds, and unpaid expiry
- Wallet account and wallet ledger foundation
- Admin analytics dashboard endpoint
- Next.js admin/customer-facing web code with authentication pages, dashboard pages, hooks, API clients, and reusable UI components

Current state caveat:

- Several flows have been manually validated, but automated unit/e2e coverage is still incomplete.
- Production KNET settlement is not complete until real merchant credentials, public HTTPS callback/webhook URLs, and provider-specific webhook verification are available.
- Notification foundation exists, but booking, waitlist, private booking, payment, wallet, and staff lifecycle emails are not fully wired yet.
- Scheduled notification jobs are not wired yet.
- Analytics endpoint shape is validated, but metric correctness still needs controlled seeded data validation.

## Delivery Scope

### Current Sprint Scope

The current sprint targets the admin/backend MVP for the Pilates-first platform:

- Authentication and session handling
- Admin/staff/customer management
- Customer invitation and password-set flow
- Notification foundation and customer-account email flow
- Pilates class and schedule management
- Booking and waitlist management
- Private trainer booking support
- Admin calendar support
- Payment and wallet foundation
- Admin analytics dashboard
- Swagger/OpenAPI contract
- Documentation cleanup and validation

### Phase 1 Product Scope: Pilates

- User registration, login, guest access, and password recovery
- Admin-created customers with immediate password creation
- Admin-created customers with invite-based password setup
- Pilates class discovery with date, trainer, and availability filters
- Class details, trainer assignment, seat availability, and waitlist behavior
- Pilates booking lifecycle: create, cancel, reschedule, list, and admin override
- Private trainer booking lifecycle
- Hosted card/KNET-style payment flow
- Wallet payment/top-up foundation
- Web admin dashboard for bookings, calendar, services, staff, customers, payments, wallet, revenue, and analytics

### Phase 2 Product Scope: Ladies Salon

Salon is future scope unless explicitly approved.

Expected Phase 2 areas:

- Salon service categories such as hair, nails, and facial services
- Service duration, price, stylist selection, and add-ons
- Multi-service cart booking
- Salon-specific staff/stylist administration
- Salon-specific scheduling rules
- Shared account, payment, wallet, notification, and administrative foundation from Phase 1

## Architecture Rules

### 1. Single-Tenant Platform

This project is for LAFAM only.

The current implementation does not support:

- Tenant onboarding
- External store-owner signup
- Tenant billing
- Tenant-specific branding
- Marketplace SaaS behavior

### 2. Backend Is the System Authority

The frontend must use the NestJS API for privileged operations.

```text
Admin Dashboard -> NestJS API -> Supabase
```

The frontend must not directly perform privileged Supabase mutations.

### 3. Swagger Is the API Contract

The backend owns the API contract through:

```text
apps/api/docs/swagger.yaml
```

Frontend integration must follow that contract.

### 4. No Shared Source Packages

The monorepo coordinates scripts, Git workflow, and Turbo tasks only.

Current rule:

- No shared UI package
- No shared DTO package
- No shared domain types package
- No shared validation package
- Frontend owns its local types
- Backend owns API contracts through Swagger/OpenAPI

### 5. Approved Changes Only

Only approved implementation changes become project truth.

Draft plans, experiments, partial snippets, or unapproved code must not be treated as the current source of truth.

### 6. Notification Boundary

Feature modules must not call Brevo directly.

Correct flow:

```text
Feature Module -> EmailNotificationService -> EmailTemplateRenderer -> EmailOutboxRepository -> BrevoEmailProvider
```

Feature modules describe what happened. The Notifications module owns recipient routing, safe template rendering, metadata safety, idempotency, outbox persistence, provider dispatch, and delivery-attempt tracking.

## Repository Structure

```text
LAFAM-Platform/
├── apps/
│   ├── api/                       NestJS backend API
│   └── web/                       Next.js web/admin application
├── supabase/
│   └── migrations/                Supabase SQL migrations
├── PLAN.md                        Implementation plan and progress log
├── README.md                      Root repository documentation
├── package.json                   Root pnpm/Turbo scripts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

## Current Backend Modules

```text
apps/api/src/modules/
├── analytics/
├── auth/
├── bookings/
├── classes/
├── core/
├── customers/
├── notifications/
├── payments/
└── staff/
```

## Current Frontend Areas

```text
apps/web/src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── unauthorized/
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── constants/
├── hooks/
├── lib/
├── modules/
├── styles/
├── types/
└── proxy.ts
```

The existence of frontend files does not automatically prove complete workflow correctness. Frontend integration must be validated against the Swagger contract and the live API behavior.

## Supabase Migrations

Current migration set:

```text
supabase/migrations/
├── 20260609152328_create_auth_tables.sql
├── 20260610102215_create_staff_module_tables.sql
├── 20260611070010_create_pilates_classes_tables.sql
├── 20260611090405_create_pilates_class_images_bucket.sql
├── 20260612055859_create_booking_module_tables.sql
├── 20260616053844_add_schedule_recurrence_private_bookings_calendar_support.sql
├── 20260617071041_add_payment_wallet_and_schedule_time_slots.sql
├── 20260620131155_fix_create_payment_intent_atomic_status_argument.sql
├── 20260620134553_fix_mark_payment_paid_atomic_gateway_arguments.sql
├── 20260620135618_fix_mark_payment_paid_atomic_ambiguous_columns.sql
├── 20260620143006_fix_payment_wallet_rpc_contracts_and_ambiguous_columns.sql
├── 20260620153423_fix_expire_payment_intents_atomic_ambiguous_status.sql
├── 20260622092716_fix_authenticated_session_expiry.sql
├── 20260624113914_add_day_of_week_to_pilates_schedule_series_time_slots.sql
├── 20260624124713_create_customer_profiles.sql
├── 20260625142254_add_booking_orders_bulk_booking_payment_support.sql
└── 20260629111534_create_notifications_and_customer_invitations.sql
```

## Technology Stack

### Workspace and Tooling

- pnpm workspaces
- Turborepo
- TypeScript
- ESLint
- Prettier
- Husky
- Git

### Backend

- NestJS 11
- TypeScript
- Supabase JavaScript SDK
- Supabase PostgreSQL/Auth/Storage
- Swagger/OpenAPI YAML contract
- Brevo transactional email API boundary
- Jest
- Supertest
- Sentry SDK dependency

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase JavaScript SDK
- Sentry SDK dependency
- Reusable local UI components

### Payments

- KWD-only payment currency in the current phase
- Backend-owned pricing
- Hosted payment provider boundary
- Mock provider for local development
- KNET/provider integration boundary prepared
- Wallet account and ledger foundation

## Local Toolchain

Expected versions:

```text
Node.js: 22.16.0+
pnpm: 10.19.0
```

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Populate the required Supabase, auth, payment, and email environment variables before running flows that depend on Auth, database, storage, payments, or notifications.

## Running the Project

Run both apps through Turbo:

```powershell
pnpm dev
```

Run only the API:

```powershell
pnpm --filter @lafam/api start:dev
```

Run only the web app:

```powershell
pnpm --filter @lafam/web dev
```

Default local URLs:

```text
Web: http://localhost:3000
API: http://localhost:4000/api
Swagger UI: http://localhost:4000/api/docs
OpenAPI JSON: http://localhost:4000/api/openapi.json
```

## Root Commands

```powershell
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm swagger:validate
pnpm check
pnpm format
pnpm format:check
pnpm security:audit
pnpm security:audit:prod
```

## API Commands

```powershell
pnpm --filter @lafam/api start:dev
pnpm --filter @lafam/api build
pnpm --filter @lafam/api lint
pnpm --filter @lafam/api typecheck
pnpm --filter @lafam/api test
pnpm --filter @lafam/api test:e2e
pnpm --filter @lafam/api swagger:validate
pnpm --filter @lafam/api check
```

## Web Commands

```powershell
pnpm --filter @lafam/web dev
pnpm --filter @lafam/web build
pnpm --filter @lafam/web start
pnpm --filter @lafam/web lint
pnpm --filter @lafam/web typecheck
pnpm --filter @lafam/web check
```

## Supabase Commands

```powershell
pnpm supabase:version
pnpm supabase:login
pnpm supabase:status
pnpm supabase:start
pnpm supabase:stop
pnpm supabase:db:pull
pnpm supabase:migration:list
```

Use `npx supabase@latest` through the root scripts to avoid stale global Supabase CLI behavior.

## Quality Gate

The expected project validation gate is:

```powershell
pnpm check
```

That runs the workspace lint, typecheck, Swagger validation, and tests through Turbo.

Before declaring a module complete, run the relevant focused checks and then the root quality gate where practical.

## Documentation Index

```text
PLAN.md                         Current implementation plan and progress log
README.md                       Root repository documentation
apps/api/README.md              Backend API documentation
apps/web/README.md              Web/admin application documentation
apps/api/docs/swagger.yaml      Backend-owned API contract
```

## Customer Invitation Flow

Admin customer creation supports exactly two legal modes.

### Password-created customer

```text
POST /api/admin/customers
```

If `password` and `confirm_password` are provided together:

- Supabase Auth user is created server-side with password.
- Email and phone are confirmed server-side where applicable.
- `app_users.status` is set to `active`.
- `customer_profiles` row is created.
- Welcome email is queued through the Notifications module.
- Password is never returned or emailed.

### Invited customer

```text
POST /api/admin/customers
```

If both password fields are omitted:

- Supabase Auth user is created server-side without customer-provided password.
- `app_users.status` is set to `invited`.
- `customer_profiles` row is created.
- `customer_invitations` row is created.
- Only the hashed invite token is stored.
- Invite email is queued through the Notifications module.
- Raw invite token is never persisted.

### Public invitation acceptance

```text
POST /api/customers/invitations/accept
```

The customer submits:

```text
token + password + confirm_password
```

Backend behavior:

- Hashes the raw token.
- Finds the pending invitation.
- Rejects accepted, expired, revoked, missing, or invalid invitations.
- Validates password and confirmation.
- Sets Supabase Auth password using server-side Admin Auth.
- Activates `app_users.status` from `invited` to `active`.
- Marks invitation as `accepted`.
- Queues invite-accepted notification.

Admin invite lifecycle endpoints:

```text
POST /api/admin/customers/invitations/{invitationId}/resend
POST /api/admin/customers/invitations/{invitationId}/revoke
```

## Notification Safety Rules

The Notifications module must enforce these rules:

- No raw invite token in database tables.
- No raw invite token in logs.
- No full invite URL in logs.
- No Civil ID in notification payloads.
- No password in email.
- No OTP in notification payloads.
- No access token or refresh token in notification payloads.
- No Brevo API key in logs or metadata.
- No raw provider payloads stored.
- Idempotency keys must prevent duplicate sends for the same event/entity.
- Provider errors must be stored safely and never exposed as raw provider responses.

## API Development Rules

- Do not trust frontend-submitted prices.
- Do not confirm payment from frontend input.
- Do not calculate booking availability with unsafe read-count-then-insert logic.
- Do not bypass Supabase/PostgreSQL atomic RPC functions for booking and wallet mutations.
- Do not expose service-role credentials to the frontend.
- Do not use Supabase Admin Auth methods outside the backend.
- Do not place business rules in controllers.
- Do not add undocumented routes without updating `apps/api/docs/swagger.yaml`.
- Do not call Brevo directly from feature modules.
- Do not store raw invite tokens.
- Do not log raw invite tokens, token hashes, full invite URLs, passwords, OTPs, refresh tokens, or access tokens.
- Do not write Civil ID values to audit metadata, notification metadata, provider payloads, or logs.
- Do not send passwords by email.
- Do not treat callback-only payment signals as payment truth.
- Do not downgrade a paid payment from later failed webhook/callback delivery.
- Keep guest capabilities limited.
- Keep Pilates and salon business flows separate.

## Current Known Gaps

- Automated test coverage is incomplete across Auth, Customers, Notifications, Staff, Classes, Booking, Private Booking, Payment, Wallet, Calendar, and Analytics.
- Production KNET settlement requires real provider credentials and webhook verification.
- Booking, waitlist, private booking, payment, wallet, and staff lifecycle email hooks are not fully wired yet.
- Scheduled notification jobs are not wired yet.
- Analytics data correctness still requires validation with controlled seeded records.
- Realtime WebSocket/SSE publishing is not wired.
- Advanced wallet loyalty, cashback, referral rewards, saved cards, KFAST, Apple Pay, and salon payment flows are out of the current scope.
- Mobile app implementation is not present in this repository.
