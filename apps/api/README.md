# LAFAM API

The LAFAM API is the backend foundation for the white-label Pilates and ladies salon booking platform. It is intended to own authentication boundaries, real-time availability, booking rules, payments, administration, notifications, and reporting APIs.

## Current Status

The API is currently a NestJS starter application.

- `GET /` returns `Hello World!`.
- Supabase and Sentry SDKs are installed but not configured in application code.
- Booking, authentication, payment, notification, admin, and reporting modules are not yet implemented.
- No database migrations currently exist under the repository's `supabase/migrations` directory.

## Intended Responsibilities

### Phase 1

- Authentication and role-based access for users, admins, trainers, and staff
- Pilates class, trainer, schedule, seat, and waiting-list management
- Real-time availability and authoritative booking validation
- Booking confirmation, cancellation, rescheduling, and attendance workflows
- KNET-ready card payment orchestration, receipts, and promo codes
- Admin-facing booking, calendar, service, revenue, and analytics APIs
- Email, SMS, push-notification, and monitoring integrations

### Phase 2

- Salon service, category, stylist, add-on, and schedule management
- Multi-service cart validation and booking
- Shared payment and administration infrastructure

Pilates and salon flows must remain separate at the business-rule level even where they reuse shared platform infrastructure.

## Technology

- NestJS 11
- TypeScript
- Jest and Supertest
- Supabase JavaScript SDK
- Sentry Node SDK
- pnpm

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

The application does not currently load `.env` automatically. Set the port in the active shell before starting the API:

```powershell
$env:PORT = "4000"
pnpm --filter api start:dev
```

The starter endpoint is available at `http://localhost:4000`.

## Environment Variables

| Variable              | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `NODE_ENV`            | Runtime environment                                      |
| `PORT`                | API listening port; expected local value is `4000`       |
| `WEB_ORIGIN`          | Allowed web application origin once CORS is configured   |
| `SUPABASE_URL`        | Supabase project URL                                     |
| `SUPABASE_SECRET_KEY` | Server-only Supabase credential; never expose to clients |
| `SENTRY_DSN`          | Server-side Sentry data source name                      |
| `BREVO_API_KEY`       | Server-only Brevo API credential                         |
| `BREVO_SENDER_EMAIL`  | Email sender address                                     |
| `BREVO_SENDER_NAME`   | Email sender display name                                |

Never commit populated `.env` files or log credentials, payment details, tokens, or personal data.

## Scripts

```powershell
pnpm --filter api start:dev   # Start in watch mode
pnpm --filter api build       # Compile to dist/
pnpm --filter api lint        # Run ESLint with fixes
pnpm --filter api format      # Format source and tests
pnpm --filter api test        # Run unit tests
pnpm --filter api test:e2e    # Run end-to-end tests
pnpm --filter api test:cov    # Generate coverage
```

## Development Direction

Keep controllers thin and enforce booking, availability, payment, and role rules in dedicated services or domain modules. API validation must remain authoritative; client-side checks may improve user experience but must not decide booking availability or payment success.

Before presenting a module as complete, add focused tests and run the relevant build, lint, unit, and end-to-end validation commands.
