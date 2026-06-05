# LAFAM Web

The LAFAM web application is intended to provide the web-based administrative experience for the LAFAM Pilates and ladies salon booking platform. Its planned responsibilities include operational dashboards, bookings, calendars, services, staff, payments, promotions, reports, and settings.

The customer-facing mobile experience shown in the product references is part of the wider product scope but is not present in this repository.

## Current Status

The web application is currently the generated Next.js starter page.

- No LAFAM dashboard or booking screens are implemented.
- Supabase and Sentry SDKs are installed but not configured in application code.
- No automated test script is currently defined.
- The application currently runs on the default Next.js development port, `3000`.

## Intended Web Scope

### Phase 1: Pilates Administration

- Dashboard metrics for revenue, bookings, customers, and cancellations
- Pilates class, trainer, schedule, capacity, and waiting-list management
- Calendar-based booking operations
- Booking override, cancellation, and rescheduling controls
- Payment, promotion, report, and configuration views

### Phase 2: Salon Administration

- Salon service, category, stylist, add-on, and availability management
- Multi-service booking operations
- Shared dashboard, payment, promotion, and reporting capabilities

Administrative UI actions must reflect backend-authoritative outcomes. The web application must not imply that a booking, payment, cancellation, or availability change succeeded until the API confirms it.

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase JavaScript SDK
- Sentry Next.js SDK
- pnpm

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm --filter web dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable                               | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_APP_URL`                  | Public URL of the web application    |
| `NEXT_PUBLIC_API_BASE_URL`             | Base URL of the LAFAM API            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public Supabase project URL          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase client key           |
| `NEXT_PUBLIC_SENTRY_DSN`               | Browser-safe Sentry data source name |

Only values intended for browser exposure may use the `NEXT_PUBLIC_` prefix. Never place server secrets or privileged Supabase keys in web environment variables.

## Scripts

```powershell
pnpm --filter web dev     # Start the development server
pnpm --filter web build   # Create a production build
pnpm --filter web start   # Start the production server
pnpm --filter web lint    # Run ESLint
```

## UX Direction

- Keep Pilates and salon operations visually and functionally distinct.
- Show availability, price, duration, staff assignment, and booking status clearly.
- Keep payment and checkout views concise and transparent.
- Use responsive, mobile-first layouts and shared design tokens.
- Avoid exposing backend, provider, database, or stack-trace details in user-facing errors.

Before presenting a web feature as complete, run lint and a production build and verify the relevant workflow against the API.
