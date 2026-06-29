<div align="center">
  <div style="display: inline-block; padding: 16px 24px; background: #ffffff; border-radius: 24px;">
    <img src="../web/public/logo.svg" alt="LAFAM logo" width="180" />
  </div>
</div>

# LAFAM API

The LAFAM API is the NestJS backend for the single-tenant LAFAM Pilates-first booking platform and admin dashboard.

The backend owns the system authority for authentication, guest sessions, customer management, customer invitation flows, staff management, Pilates class and schedule management, booking lifecycle, waitlists, private trainer bookings, payment state, wallet ledger operations, admin calendar feeds, analytics, and email notification outbox delivery.

## Current Status

This API is no longer a starter NestJS application.

Implemented backend areas include:

- Core API identity and health endpoints
- Global HTTP baseline: CORS, validation, security headers, request logging, exception filtering, and shutdown hooks
- Environment validation and centralized runtime config
- Supabase public/admin client setup
- Auth module
- Guest session module
- Customer admin management
- Customer invitation creation, resend, revoke, and public acceptance flow
- Notifications module foundation with email outbox, delivery attempts, template rendering, Brevo provider boundary, idempotency, and safe metadata rules
- Staff/trainer management
- Pilates class and schedule management
- Pilates class image bucket support
- Recurring schedule generation
- Multi-time schedule slots
- Booking module
- FIFO waitlist foundation
- Private trainer booking module
- Admin booking calendar
- Payment module
- Wallet module
- Admin analytics dashboard module
- Swagger/OpenAPI YAML contract

Known backend gaps:

- Production KNET settlement is blocked until real provider credentials and webhook behavior are available.
- Notification foundation exists, but booking, waitlist, private booking, payment, wallet, and staff lifecycle emails are not fully wired yet.
- Scheduled notification jobs are not wired yet.
- Realtime WebSocket/SSE publishing is not wired yet.
- Automated test coverage is still incomplete.
- Analytics correctness still needs controlled test data validation.

## Architecture Rules

### Backend Authority

All privileged operations must go through the NestJS API.

```text
Admin Dashboard -> NestJS API -> Supabase
```

The frontend must not directly mutate privileged Supabase data.

### API Contract

The API contract is owned here:

```text
apps/api/docs/swagger.yaml
```

Swagger UI is served locally at:

```text
http://localhost:4000/api/docs
```

OpenAPI JSON is served locally at:

```text
http://localhost:4000/api/openapi.json
```

### Module Boundary

Controllers stay thin.

Business rules belong in:

```text
application/
domain/
repositories/
```

DTOs own request validation. Repositories own Supabase/database access. Services own use-case orchestration. Domain policy files own pure lifecycle and validation logic where possible.

### Notification Boundary

Feature modules must not call Brevo directly.

Correct flow:

```text
Feature Module -> EmailNotificationService -> EmailTemplateRenderer -> EmailOutboxRepository -> BrevoEmailProvider
```

Feature modules describe what happened. The Notifications module owns recipient routing, template rendering, safe metadata filtering, idempotency, outbox persistence, provider dispatch, and delivery-attempt tracking.

## Backend Module Map

```text
apps/api/src/modules/
├── analytics/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── dto/
│   ├── repositories/
│   ├── types/
│   └── analytics.module.ts
├── auth/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   ├── repositories/
│   ├── types/
│   ├── utils/
│   └── auth.module.ts
├── bookings/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── domain/
│   ├── dto/
│   ├── repositories/
│   ├── types/
│   └── bookings.module.ts
├── classes/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── domain/
│   ├── dto/
│   ├── repositories/
│   ├── types/
│   └── classes.module.ts
├── core/
│   ├── core.controller.ts
│   ├── core.module.ts
│   └── foundation-health.service.ts
├── customers/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── dto/
│   ├── repositories/
│   ├── types/
│   ├── utils/
│   └── customers.module.ts
├── notifications/
│   ├── application/
│   ├── constants/
│   ├── domain/
│   ├── repositories/
│   ├── types/
│   └── notifications.module.ts
├── payments/
│   ├── application/
│   ├── constants/
│   ├── controllers/
│   ├── domain/
│   ├── dto/
│   ├── guards/
│   ├── repositories/
│   ├── types/
│   └── payments.module.ts
└── staff/
    ├── application/
    ├── constants/
    ├── controllers/
    ├── dto/
    ├── repositories/
    ├── types/
    └── staff.module.ts
```

## Current Route Groups

The Swagger contract exposes these route groups:

```text
Core
Auth - Public
Auth - Guest
Auth - Sessions
Auth - Profile
Auth - Admin
Auth - Context
Customers - Public
Customers - Admin
Staff - Admin
Pilates - Public
Pilates - Admin
Bookings - Customer
Bookings - Admin
Payments - Customer
Payments - Public
Payments - Admin
Wallet - Customer
Wallet - Admin
Analytics - Admin
```

## Important Runtime Routes

```text
GET  /api
GET  /api/health
GET  /api/health/foundation
GET  /api/docs
GET  /api/openapi.json
```

Current latest backend checkpoints:

```text
GET  /api/admin/customers
POST /api/admin/customers
POST /api/admin/customers/invitations/{invitationId}/resend
POST /api/admin/customers/invitations/{invitationId}/revoke
POST /api/customers/invitations/accept
GET  /api/admin/analytics/dashboard
```

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

The API depends on these migrations being applied to the linked Supabase project.

## Technology

- NestJS 11
- TypeScript
- Supabase JavaScript SDK
- Supabase PostgreSQL/Auth/Storage
- Swagger/OpenAPI YAML
- Brevo transactional email API
- Jest
- Supertest
- class-validator
- class-transformer
- Sentry Node SDK dependency
- pnpm

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

Populate required values in:

```text
apps/api/.env
```

Start the API:

```powershell
pnpm --filter @lafam/api start:dev
```

Open:

```text
API base: http://localhost:4000/api
Swagger UI: http://localhost:4000/api/docs
OpenAPI JSON: http://localhost:4000/api/openapi.json
```

## Environment Variables

### App

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `NODE_ENV`          | Runtime environment: development, test, staging, or production |
| `PORT`              | API listening port; local default is `4000`                    |
| `API_GLOBAL_PREFIX` | Global API prefix; current default is `api`                    |
| `WEB_ORIGIN`        | Allowed browser origin for CORS                                |

### Supabase

| Variable                   | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`             | Supabase project URL                                                  |
| `SUPABASE_PUBLISHABLE_KEY` | Public Supabase key used by server-side provider clients where needed |
| `SUPABASE_SECRET_KEY`      | Server-only Supabase service credential                               |

### Sentry

| Variable                    | Purpose                              |
| --------------------------- | ------------------------------------ |
| `SENTRY_DSN`                | Server-side Sentry DSN               |
| `SENTRY_ENVIRONMENT`        | Sentry environment name              |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry trace sample rate from 0 to 1 |

### Email Notifications

| Variable                              | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `EMAIL_NOTIFICATIONS_ENABLED`         | Enables or disables email notification creation and dispatch behavior  |
| `EMAIL_PROVIDER`                      | Email provider identifier; current supported value is `brevo`          |
| `EMAIL_OUTBOX_ENABLED`                | Enables database-backed notification outbox persistence                |
| `EMAIL_DEFAULT_LOCALE`                | Default email template locale                                          |
| `EMAIL_PUBLIC_APP_BASE_URL`           | Public frontend base URL used to build customer-facing invite links    |
| `CUSTOMER_INVITE_TOKEN_TTL_HOURS`     | Customer invite token lifetime in hours                                |
| `CUSTOMER_INVITE_EXPIRING_SOON_HOURS` | Window used by future scheduled invite-expiring-soon notification jobs |

### Brevo

| Variable             | Purpose                            |
| -------------------- | ---------------------------------- |
| `BREVO_API_KEY`      | Server-only Brevo API credential   |
| `BREVO_SENDER_EMAIL` | Transactional email sender address |
| `BREVO_SENDER_NAME`  | Sender display name                |

When `EMAIL_NOTIFICATIONS_ENABLED=true` and `EMAIL_PROVIDER=brevo`, Brevo sender credentials must be configured.

### Security

| Variable                      | Purpose                        |
| ----------------------------- | ------------------------------ |
| `JWT_CLOCK_TOLERANCE_SECONDS` | JWT clock tolerance in seconds |
| `REQUEST_BODY_LIMIT`          | API request body limit         |

### Auth

| Variable                                  | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `AUTH_ACCESS_TOKEN_HASH_PEPPER`           | Server-only pepper used for token hashing   |
| `AUTH_SESSION_TTL_HOURS`                  | LAFAM application session lifetime          |
| `AUTH_RESET_TOKEN_TTL_MINUTES`            | Reset-token validity window                 |
| `AUTH_MAX_RESET_OTP_ATTEMPTS`             | Maximum reset OTP attempts                  |
| `AUTH_AVATAR_BUCKET`                      | Supabase Storage bucket for avatars         |
| `AUTH_AVATAR_MAX_SIZE_BYTES`              | Maximum avatar file size                    |
| `AUTH_AVATAR_SIGNED_URL_TTL_SECONDS`      | Signed avatar URL lifetime                  |
| `AUTH_GUEST_SESSION_TTL_HOURS`            | Guest session lifetime                      |
| `AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR` | Guest session rate limit                    |
| `AUTH_GUEST_REQUIRE_CAPTCHA`              | Captcha requirement flag for guest sessions |
| `AUTH_GUEST_CLEANUP_ENABLED`              | Expired guest cleanup/enforcement flag      |

### Payments

| Variable                       | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`             | Payment provider: `mock`, `knet`, `tap`, `myfatoorah`, or `checkout` |
| `PAYMENT_MODE`                 | `sandbox` or `production`                                            |
| `PAYMENT_DEFAULT_CURRENCY`     | Current supported currency; expected `KWD`                           |
| `PAYMENT_PUBLIC_BASE_URL`      | Public backend base URL used for callback/webhook URLs               |
| `PAYMENT_FRONTEND_SUCCESS_URL` | Frontend redirect URL after successful payment                       |
| `PAYMENT_FRONTEND_FAILURE_URL` | Frontend redirect URL after failed/cancelled/expired payment         |

### KNET / Hosted Provider

| Variable                    | Purpose                          |
| --------------------------- | -------------------------------- |
| `KNET_MERCHANT_ID`          | Provider merchant ID             |
| `KNET_SECRET_KEY`           | Provider secret key              |
| `KNET_WEBHOOK_SECRET`       | Provider webhook signing secret  |
| `KNET_API_BASE_URL`         | Production provider API base URL |
| `KNET_SANDBOX_API_BASE_URL` | Sandbox provider API base URL    |

### Pilates

| Variable                     | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `PILATES_CLASS_IMAGE_BUCKET` | Supabase Storage bucket for Pilates class images |

Never commit populated `.env` files. Never log credentials, tokens, invite tokens, token hashes, passwords, payment details, raw provider payload secrets, Civil ID values, or other sensitive personal data.

## Scripts

Run from the repository root.

```powershell
pnpm --filter @lafam/api start:dev
pnpm --filter @lafam/api build
pnpm --filter @lafam/api lint
pnpm --filter @lafam/api lint:fix
pnpm --filter @lafam/api typecheck
pnpm --filter @lafam/api test
pnpm --filter @lafam/api test:e2e
pnpm --filter @lafam/api test:cov
pnpm --filter @lafam/api swagger:validate
pnpm --filter @lafam/api check
```

## Validation Gate

Focused backend validation:

```powershell
pnpm --filter @lafam/api typecheck
pnpm --filter @lafam/api lint
pnpm --filter @lafam/api swagger:validate
pnpm --filter @lafam/api test
```

Full backend package gate:

```powershell
pnpm --filter @lafam/api check
```

Root gate:

```powershell
pnpm check
```

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

## Customer Invitation Flow

Admin customer creation supports exactly two modes.

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

## Current Known Gaps

- Automated tests need expansion across Auth, Customers, Notifications, Staff, Classes, Booking, Private Booking, Payment, Wallet, Calendar, and Analytics.
- Analytics data correctness needs validation against controlled seeded data.
- KNET production settlement requires live provider credentials and webhook verification.
- Booking, waitlist, private booking, payment, wallet, and staff lifecycle email hooks are not fully wired yet.
- Scheduled notification jobs are not wired yet.
- Realtime event publishing is not wired.
- Membership/package purchase flow is not fully implemented.
- Salon-specific APIs are out of current sprint scope.
