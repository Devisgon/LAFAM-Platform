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
- Next.js admin/customer-facing web code with authentication pages, admin pages, hooks, API clients, and reusable UI components

Current state caveat:

- Several flows have been manually validated, but automated unit/e2e coverage is still incomplete.
- Production KNET settlement is not complete until real merchant credentials, public HTTPS callback/webhook URLs, and provider-specific webhook verification are available.
- Brevo/email notification hooks are planned but not wired as a complete notification module.
- Analytics endpoint shape is validated, but metric correctness still needs controlled seeded data validation.

## Delivery Scope

### Current Sprint Scope

The current sprint targets the admin/backend MVP for the Pilates-first platform:

- Authentication and session handling
- Admin/staff/user management
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
- Pilates class discovery with date, trainer, and availability filters
- Class details, trainer assignment, seat availability, and waitlist behavior
- Pilates booking lifecycle: create, cancel, reschedule, list, and admin override
- Private trainer booking lifecycle
- Hosted card/KNET-style payment flow
- Wallet payment/top-up foundation
- Web admin dashboard for bookings, calendar, services, staff, payments, wallet, revenue, and analytics

### Phase 2 Product Scope: Ladies Salon

Salon is future scope unless explicitly approved.

Expected Phase 2 areas:

- Salon service categories such as hair, nails, and facial services
- Service duration, price, stylist selection, and add-ons
- Multi-service cart booking
- Salon-specific staff/stylist administration
- Salon-specific scheduling rules
- Shared account, payment, wallet, and administrative foundation from Phase 1

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

## Repository Structure

```text
LAFAM-Platform/
├── apps/
│   ├── api/                       NestJS backend API
│   └── web/                       Next.js web/admin application
├── docs/                          Project documentation
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
├── payments/
└── staff/
```

## Current Frontend Areas

```text
apps/web/src/app/
├── admin/
│   ├── bookings/
│   ├── calendar/
│   ├── payments/
│   ├── services/pilates/
│   ├── settings/
│   ├── staff/
│   └── wallet/
├── auth/
│   ├── forgot-password/
│   └── verify-email/
├── signup/
├── unauthorized/
└── page.tsx
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
└── 20260617071041_add_payment_wallet_and_schedule_time_slots.sql
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
- Jest
- Supertest
- Sentry SDK dependency
- Brevo planned for transactional email

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
Node.js: 22.16.0
pnpm: 10.19.0
```

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Populate the required Supabase and payment environment variables before running flows that depend on Auth, database, storage, or payments.

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
docs/structure.md               Current project structure snapshot
```

## Current Known Gaps

- README files are being updated from stale scaffold documentation.
- Automated test coverage is incomplete across several modules.
- Production KNET settlement requires real provider credentials and webhook verification.
- Notification/email hooks are not fully wired.
- Analytics data correctness still requires validation with controlled seeded records.
- Realtime WebSocket/SSE publishing is not wired, although domain-event foundations exist.
- Advanced wallet loyalty, cashback, referral rewards, saved cards, KFAST, Apple Pay, and salon payment flows are out of the current scope.
- Mobile app implementation is not present in this repository.
