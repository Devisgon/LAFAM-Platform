# LAFAM Platform

LAFAM is a white-label booking platform for wellness and beauty services in Kuwait. The product combines a Pilates studio booking experience with a ladies salon service experience while keeping both booking flows operationally separate.

The agreed delivery approach is phased:

- **Phase 1:** production-ready Pilates booking platform, booking engine, payments, and web-based admin dashboard.
- **Phase 2:** ladies salon services, multi-service cart booking, stylist selection, and salon-specific administration built on the Phase 1 foundation.

## Current Repository Status

This repository is currently an early development scaffold, not a completed booking platform.

- `apps/api` contains the NestJS starter endpoint and project tooling.
- `apps/web` contains the generated Next.js starter page and project tooling.
- `supabase/migrations` exists but does not currently contain database migrations.
- A mobile application is part of the product scope but is not present in this repository.
- Booking, authentication, payments, admin operations, notifications, Supabase access, and Sentry reporting are not yet wired into the application code.

Keep planned product scope separate from implemented behavior when adding documentation or features.

## Product Scope

### Phase 1: Pilates

- User registration, login, guest access, and password recovery
- Pilates class discovery with date, trainer, and availability filters
- Class details, trainer assignment, seat availability, and waiting lists
- Single-class and package/subscription booking
- Upcoming and historical bookings with cancellation and rescheduling
- Secure card payments with KNET readiness
- Web admin dashboard for bookings, calendars, services, staff, revenue, and analytics

### Phase 2: Ladies Salon

- Salon service categories such as hair, nails, and facial services
- Service duration, price, stylist selection, and add-ons
- Multi-service cart and time-slot scheduling
- Salon-specific service and staff administration
- Shared account, payment, and administrative foundations from Phase 1

### Product Rules

- Pilates and salon booking flows must remain clearly separated.
- Availability must be authoritative and updated in real time.
- Full Pilates classes must offer a waiting-list path.
- Checkout should be concise, transparent, and summary-focused.
- Guest users have limited account capabilities and no booking history.
- Prices are represented in Kuwaiti dinar (`KWD`).

## Repository Structure

```text
.
|-- apps/
|   |-- api/       NestJS backend API
|   `-- web/       Next.js web and admin application
|-- docs/          Project documentation
|-- supabase/
|   `-- migrations/  Database migrations
|-- package.json
|-- pnpm-lock.yaml
`-- pnpm-workspace.yaml
```

## Current Technology Stack

- **Workspace:** pnpm workspaces
- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **API:** NestJS 11, TypeScript, Jest
- **Planned data/auth integration:** Supabase
- **Planned monitoring:** Sentry
- **Planned email integration:** Brevo

## Local Setup

The current local toolchain uses Node.js `22.16.0` and pnpm `10.19.0`.

```powershell
pnpm install

Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

Run the web application:

```powershell
pnpm --filter web dev
```

Run the API on port `4000` in another terminal:

```powershell
$env:PORT = "4000"
pnpm --filter api start:dev
```

Open:

- Web: `http://localhost:3000`
- API starter endpoint: `http://localhost:4000`

The API does not currently load `.env` files automatically. Set required API environment variables in the shell until environment configuration is implemented.

## Application Documentation

- [API README](apps/api/README.md)
- [Web README](apps/web/README.md)

## Development Commands

```powershell
# API
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e

# Web
pnpm --filter web build
pnpm --filter web lint
```

The root `test` script is currently a placeholder and should not be treated as a repository-wide validation command.

## Delivery Direction

The intended Phase 1 delivery sequence is:

1. Requirements, architecture, database design, and API documentation
2. Authentication, slot logic, and Pilates booking APIs
3. Customer booking experience integration
4. Payments and admin dashboard
5. Unit testing, fixes, deployment preparation, and handover

Third-party services such as KNET/card payment gateways, SMS/email providers, hosting, and mobile app store accounts require separate credentials and provider setup.
