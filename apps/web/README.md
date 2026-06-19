<div align="center">
  <div style="display: inline-block; padding: 16px 24px; background: #ffffff; border-radius: 24px;">
    <img src="public/logo.svg" alt="LAFAM logo" width="180" />
  </div>
</div>

# LAFAM Web

The LAFAM web application is the Next.js web/admin application for the single-tenant LAFAM Pilates-first booking platform.

The web app provides the admin dashboard surface and browser-based flows that integrate with the NestJS API. The API remains the authority for authentication, booking, payment, wallet, and admin mutations.

## Current Status

This web app is no longer only the generated Next.js starter page.

Current implemented areas in the source tree include:

- Root app layout and global styling
- Public landing/home page
- Signup page
- Email verification page
- Forgot-password, reset-password, and reset OTP verification pages
- Unauthorized page
- Admin dashboard page
- Admin bookings page
- Admin calendar page
- Admin payments page
- Admin Pilates services page
- Admin settings page
- Admin staff page
- Admin wallet page
- Sidebar and top bar components
- Profile settings component
- Staff directory component
- Pilates class management components
- Payment and wallet management components
- Admin user management component
- Reusable UI components
- Auth, staff, Pilates, booking, payment, wallet, and profile API client files
- React hooks for Auth, Staff, Pilates, Admin Bookings, Admin Booking Calendar, Admin Payments, Admin Wallets, Admin Users, and Profile Sessions

Current state caveat:

- File presence does not prove complete workflow correctness.
- Each screen and API client must be validated against `apps/api/docs/swagger.yaml`.
- Some flows still need testing and cleanup.
- Documentation is being updated from stale scaffold state.

## Architecture Rules

### Backend Authority

The web app must not perform privileged Supabase mutations directly.

Correct flow:

```text
Web/Admin UI -> NestJS API -> Supabase
```

### Swagger Contract

Frontend API integration must follow:

```text
apps/api/docs/swagger.yaml
```

If the frontend request or response type disagrees with Swagger, Swagger and the API implementation are the source of truth.

### Local Types

The frontend owns local TypeScript types for UI/API client usage.

Do not introduce shared DTO/domain packages unless the project rule is explicitly changed later.

## Current Route Map

```text
apps/web/src/app/
├── admin/
│   ├── bookings/page.tsx
│   ├── calendar/page.tsx
│   ├── payments/page.tsx
│   ├── services/pilates/page.tsx
│   ├── settings/page.tsx
│   ├── staff/page.tsx
│   ├── wallet/page.tsx
│   └── page.tsx
├── auth/
│   ├── forgot-password/page.tsx
│   ├── forgot-password/reset/page.tsx
│   ├── forgot-password/verify/page.tsx
│   └── verify-email/page.tsx
├── signup/page.tsx
├── unauthorized/page.tsx
├── globals.css
├── layout.tsx
└── page.tsx
```

## Current Frontend Source Areas

```text
apps/web/src/
├── app/
├── components/
│   ├── reuseable_ui_components/
│   ├── admin_payment_manager.tsx
│   ├── admin_settings.tsx
│   ├── admin_user_manager.tsx
│   ├── admin_wallet_manager.tsx
│   ├── page_header.tsx
│   ├── password_reset_shell.tsx
│   ├── pilates_class_detail_manager.tsx
│   ├── pilates_class_manager.tsx
│   ├── profile_settings.tsx
│   ├── sidebar.tsx
│   ├── staff_directory.tsx
│   ├── theme_switcher.tsx
│   └── top_bar.tsx
├── hooks/
│   ├── useAdminBookingCalendar.ts
│   ├── useAdminBookings.ts
│   ├── useAdminPayments.ts
│   ├── useAdminUsers.ts
│   ├── useAdminWallets.ts
│   ├── useAuth.tsx
│   ├── usePilates.ts
│   ├── useProfileSessions.ts
│   └── useStaff.ts
├── lib/
│   ├── admin-bookings.ts
│   ├── admin-users.ts
│   ├── admin-wallets.ts
│   ├── auth.ts
│   ├── payment.ts
│   ├── pilates.ts
│   ├── profile-sessions.ts
│   └── staff.ts
└── proxy.ts
```

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase JavaScript SDK
- Sentry Next.js SDK dependency
- pnpm

## Local Setup

From the repository root:

```powershell
pnpm install
Copy-Item apps/web/.env.example apps/web/.env.local
```

Populate required values in:

```text
apps/web/.env.local
```

Start the web app:

```powershell
pnpm --filter @lafam/web dev
```

Open:

```text
http://localhost:3000
```

Run the API separately:

```powershell
pnpm --filter @lafam/api start:dev
```

Expected local API base:

```text
http://localhost:4000/api
```

## Environment Variables

| Variable                               | Purpose                           |
| -------------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Public URL of the web application |
| `NEXT_PUBLIC_API_BASE_URL`             | Base URL of the LAFAM API         |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public Supabase project URL       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase client key        |
| `NEXT_PUBLIC_SENTRY_DSN`               | Browser-safe Sentry DSN           |

Only browser-safe values may use the `NEXT_PUBLIC_` prefix.

Never put these values in web environment variables:

- Supabase service role key
- API secret keys
- Payment provider secret keys
- KNET secrets
- Brevo API keys
- JWT/token peppers
- Private webhook secrets

## Scripts

Run from the repository root.

```powershell
pnpm --filter @lafam/web dev
pnpm --filter @lafam/web build
pnpm --filter @lafam/web start
pnpm --filter @lafam/web lint
pnpm --filter @lafam/web lint:fix
pnpm --filter @lafam/web typecheck
pnpm --filter @lafam/web check
pnpm --filter @lafam/web format
```

## Validation Gate

Focused web validation:

```powershell
pnpm --filter @lafam/web typecheck
pnpm --filter @lafam/web lint
pnpm --filter @lafam/web build
```

Web package gate:

```powershell
pnpm --filter @lafam/web check
```

Root gate:

```powershell
pnpm check
```

## Integration Rules

- Do not mark booking, cancellation, payment, refund, or wallet actions as successful until the API confirms success.
- Do not trust frontend-calculated prices.
- Do not submit card data to the LAFAM backend.
- Do not expose backend stack traces or provider details to users.
- Do not assume a route exists unless it is in Swagger or confirmed in the API source.
- Do not bypass API ownership checks by passing user IDs from the UI where the backend expects authenticated context.
- Keep Pilates and salon operations visually and functionally separate.
- Show availability, status, price, duration, trainer assignment, and payment state clearly.
- Use existing reusable components before adding duplicated UI structures.

## Current Admin Areas

### Dashboard

Uses backend analytics once connected to:

```text
GET /api/admin/analytics/dashboard
```

### Staff

Uses admin staff APIs for staff/trainer creation, listing, update, availability, deactivation, reactivation, and soft deletion.

### Pilates Services

Uses admin Pilates class and schedule APIs for class definitions, schedule creation, recurring schedules, multi-time slots, and class image handling.

### Bookings

Uses admin booking APIs for class bookings, private trainer bookings, waitlists, rescheduling, cancellation, and override operations.

### Calendar

Uses admin calendar APIs for normalized class schedule and private trainer booking feeds.

### Payments

Uses admin payment APIs for payment listing, detail, transactions, refunds, and unpaid payment expiry.

### Wallet

Uses admin wallet APIs for wallet listing, user wallet detail, ledger reads, and audited adjustment boundaries.

### Settings

Settings UI exists, but each settings action must be verified against actual backend-supported endpoints before being treated as complete.

## UX Rules

- Keep admin actions explicit and reversible where possible.
- Use clear loading, empty, error, and success states.
- Keep forms aligned with backend DTO validation.
- Avoid large unbounded API reads.
- Use pagination/filters where backend supports them.
- Keep payment UI concise and transparent.
- Keep destructive actions behind explicit confirmation.
- Do not hide backend validation failures behind generic messages during admin workflows.

## Current Known Gaps

- API alignment must be reviewed screen by screen.
- Caching/background refresh behavior must be audited before large-data screens are treated as production-ready.
- Automated frontend tests are not currently established.
- Some frontend screens may need cleanup to reduce duplicate UI logic.
- Analytics dashboard frontend integration needs validation against the latest backend response shape.
- Payment and wallet screens need full flow verification against the live API.
- Notification/email UI behavior should wait until the backend notification hooks exist.
