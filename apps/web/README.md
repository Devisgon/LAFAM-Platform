# LAFAM Web Frontend

This app is the Next.js frontend for the LAFAM admin and staff portal. It is built around server-rendered routes, authenticated dashboard layouts, lightweight module APIs, shared UI components, and permission-aware screens.

The frontend does not own business rules. It displays data, collects user input, calls the NestJS API, and hides or locks actions based on the `/auth/context` response. The backend remains the final authority for authentication, permissions, booking state, payments, wallet mutations, and staff/customer changes.

## App Workflow

1. A user opens the app.
2. `src/proxy.ts` runs before protected routes and checks session cookies.
3. If a protected route is requested, the proxy verifies the session through the API and loads `/auth/context`.
4. The proxy allows or blocks the route using the context permissions.
5. The dashboard layout calls `getServerAuthContext()` again on the server for SSR-safe layout rendering.
6. `PermissionGuard` checks the page route permission before rendering the page.
7. The page renders a module manager component, such as `AdminBookingManager`.
8. Client components use small module hooks and API clients to load data, mutate records, and refresh UI state.
9. Write buttons are hidden or disabled when the user only has read permission.

## Authentication And Authorization Flow

Auth starts in `src/proxy.ts` and continues in server components.

- `lafam_access_token`, `lafam_refresh_token`, `lafam_role`, and `lafam_session_id` are the browser session cookies.
- The proxy refreshes the session when possible.
- The proxy calls `/auth/context` to get the real role, permissions, session, and access flags.
- Admin users can access all admin portal pages through `can_access_admin_dashboard`.
- Staff, trainer, and stylist users can only access pages allowed by their returned permissions.
- Customer, user, and guest accounts cannot access the admin or staff dashboard shell.
- `PermissionGuard` provides the in-page lock screen when a user reaches a route but lacks permission.
- Sidebar links are also locked using the same route access helper.

Important files:

- `src/proxy.ts` protects routes before page rendering.
- `src/lib/auth/session.ts` reads server-side auth cookies.
- `src/lib/auth/auth-context.ts` fetches `/auth/context`.
- `src/lib/auth/admin-access.ts` maps routes to required permissions.
- `src/components/guards/PermissionGuard.tsx` blocks protected page content.
- `src/components/guards/AccessDeniedPanel.tsx` displays the locked state.

## Main Frontend Areas

### Login And Auth

The auth route group lives in `src/app/(auth)`.

- `/login` renders the login screen.
- `/forgot-password` starts password reset.
- `/forgot-password/verify` verifies the reset OTP.
- `/forgot-password/reset` sets the new password.

The module code lives in `src/modules/auth`.

- `api/authApi.ts` calls login, logout, refresh, profile, avatar, password, and reset endpoints.
- `hooks/useAuth.tsx` manages client-side auth actions.
- `hooks/useProfileSessions.ts` manages active session lists.
- `components/PasswordResetShell.tsx` provides the reset flow UI shell.
- `types/auth.types.ts` contains auth-facing TypeScript types.

### Dashboard Shell

The dashboard route group lives in `src/app/(dashboard)`.

- `layout.tsx` loads the auth context server-side.
- `DashboardShell` renders `TopBar`, `Sidebar`, `PageHeader`, and page content.
- The shell receives the auth context so navigation can lock pages the user cannot access.

Dashboard shell files:

- `components/layout/DashboardShell/DashboardShell.tsx`
- `components/layout/TopBar/TopBar.tsx`
- `components/layout/Sidebar/Sidebar.tsx`
- `components/layout/PageHeader/PageHeader.tsx`

### Bookings

The bookings page is `src/app/(dashboard)/bookings/page.tsx`.

It uses:

- `PermissionGuard route="/bookings"`
- `getServerAuthContext()` to pass permissions into the booking manager
- `AdminBookingManager` for the full booking UI

The booking module lives in `src/modules/bookings`.

- `api/adminBookingsApi.ts` calls admin booking, private booking, calendar, order, and waitlist endpoints.
- `hooks/useAdminBookings.ts` loads class bookings, private bookings, and schedule waitlists.
- `components/AdminBookingManager.tsx` renders tabs for class bookings, private bookings, and waitlist entries.
- `types/bookings.types.ts` re-exports booking types for the app.

Permission behavior:

- `admin:bookings:read` can view bookings.
- `admin:bookings:create` can create private bookings.
- `admin:bookings:bulk_create` can create class booking orders.
- `admin:bookings:cancel` can cancel bookings.
- `admin:bookings:reschedule` can reschedule bookings.
- `admin:bookings:override` can override booking status.
- `admin:bookings:waitlist` can remove waitlist entries.
- Users without write permissions still see records but do not see edit/action buttons.

### Calendar

The calendar page is `src/app/(dashboard)/calendar/page.tsx`.

The module lives in `src/modules/calendar`.

- `api/calendarApi.ts` calls admin calendar APIs.
- `hooks/useAdminBookingCalendar.ts` loads calendar events.
- `components/AdminCalendar.tsx` renders the calendar view.
- `types/calendar.types.ts` stores calendar types.

Calendar access is controlled by `admin:bookings:calendar`.

### Pilates Services

Pilates pages live in:

- `src/app/(dashboard)/services/pilates/page.tsx`
- `src/app/(dashboard)/services/pilates/[classId]/page.tsx`

The module lives in `src/modules/services/pilates`.

- `api/pilatesApi.ts` calls class and schedule endpoints.
- `hooks/usePilates.ts` loads classes, schedules, and trainers.
- `components/PilatesClassManager.tsx` renders the class list and create flow.
- `components/PilatesClassDetailManager.tsx` renders class detail, edit, schedule create/edit/cancel/delete.
- `types/pilates.types.ts` re-exports Pilates types.

This area is currently admin-dashboard controlled because the backend permission model does not yet expose separate Pilates service permissions.

### Staff

The staff page is `src/app/(dashboard)/staff/page.tsx`.

The module lives in `src/modules/staff`.

- `api/staffApi.ts` calls staff CRUD and availability APIs.
- `hooks/useStaff.ts` loads and mutates staff records.
- `components/StaffDirectory.tsx` renders the staff table, create form, detail panel, edit form, and deactivate/reactivate/delete actions.
- `types/staff.types.ts` contains staff types.

This area is admin-dashboard controlled.

### Customers And Settings

Settings live in `src/app/(dashboard)/settings/page.tsx`.

Customer detail lives in:

- `src/app/(dashboard)/settings/customers/[customerId]/page.tsx`

Modules:

- `src/modules/settings` handles profile and settings screens.
- `src/modules/customers` handles admin customer list, lookup, create, update, and detail APIs.

Important files:

- `modules/settings/components/ProfileSettings.tsx`
- `modules/settings/components/AdminSettings.tsx`
- `modules/customers/components/AdminCustomerManager.tsx`
- `modules/customers/api/customersApi.ts`
- `modules/customers/hooks/useAdminCustomers.ts`

Permission behavior:

- `profile:read` can open personal settings.
- `admin:customers:read` can view customer management and customer detail pages.
- Customer write actions depend on customer-specific permissions returned by `/auth/context`.

### Users

The users page is `src/app/(dashboard)/users/page.tsx`.

The module lives in `src/modules/users`.

- `api/usersApi.ts` calls admin user endpoints.
- `hooks/useAdminUsers.ts` loads users and performs user actions.
- `components/AdminUserManager.tsx` renders the users table and action buttons.
- `types/users.types.ts` contains user management types.

Permission behavior:

- `admin:users:read` can view users.
- `admin:users:deactivate` can deactivate users.
- `admin:users:reactivate` can reactivate users.
- `super_admin:users:hard_delete` can hard-delete users.

### Payments

The payments page is `src/app/(dashboard)/payments/page.tsx`.

The module lives in `src/modules/payments`.

- `api/paymentsApi.ts` calls payment APIs.
- `hooks/useAdminPayments.ts` loads payment lists and detail records.
- `components/AdminPaymentManager.tsx` renders payment tables and detail panels.
- `types/payments.types.ts` contains payment types.

This area is admin-dashboard controlled unless the backend exposes more specific payment admin permissions.

### Wallet

The wallet page is `src/app/(dashboard)/wallet/page.tsx`.

The module lives in `src/modules/wallet`.

- `api/adminWalletApi.ts` calls wallet APIs.
- `hooks/useAdminWallets.ts` loads wallet data.
- `components/AdminWalletManager.tsx` renders wallet accounts and transaction views.
- `types/wallet.types.ts` contains wallet types.

Wallet mutations must remain backend-owned. The frontend should not calculate ledger state.

## Folder Structure

```text
apps/web
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── public
│   ├── logo.svg
│   ├── login-logo.svg
│   └── login_bg.jpg
└── src
    ├── app
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   ├── unauthorized
    │   ├── (auth)
    │   │   ├── layout.tsx
    │   │   ├── login
    │   │   └── forgot-password
    │   └── (dashboard)
    │       ├── layout.tsx
    │       ├── dashboard
    │       ├── bookings
    │       ├── calendar
    │       ├── payments
    │       ├── services
    │       │   └── pilates
    │       ├── settings
    │       │   └── customers
    │       ├── staff
    │       ├── users
    │       └── wallet
    ├── components
    │   ├── data-display
    │   ├── feedback
    │   ├── forms
    │   ├── guards
    │   ├── layout
    │   └── ui
    ├── constants
    ├── hooks
    ├── lib
    │   ├── api
    │   ├── auth
    │   ├── cache
    │   ├── error
    │   └── security
    ├── modules
    │   ├── auth
    │   ├── bookings
    │   ├── calendar
    │   ├── customers
    │   ├── dashboard
    │   ├── payments
    │   ├── services
    │   │   └── pilates
    │   ├── settings
    │   ├── staff
    │   ├── users
    │   └── wallet
    ├── styles
    └── types
```

## Why Each Top-Level Folder Exists

### `src/app`

This is the Next.js App Router folder. It defines routes, layouts, loading boundaries, and server-rendered pages.

Why it exists:

- Keeps URL routes explicit.
- Lets protected layouts fetch auth context on the server.
- Keeps page files thin by delegating business UI to modules.

Typical page pattern:

```tsx
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminBookingManager } from "@/modules/bookings";

export default function BookingsPage() {
  return (
    <PermissionGuard route="/bookings">
      <AdminBookingManager />
    </PermissionGuard>
  );
}
```

### `src/components`

This folder contains shared, reusable components that are not owned by one business module.

Subfolders:

- `ui`: primitive UI pieces such as `Button`, `Badge`, `Card`, `Input`, `Toast`, `Switch`, `Radio`, and `Checkbox`.
- `layout`: dashboard shell pieces such as sidebar, top bar, and page header.
- `guards`: auth and permission wrappers.
- `data-display`: reusable tables, empty states, loading states, class cards, filter bars, and wallet transaction tables.
- `feedback`: confirmation and destructive action cards.
- `forms`: shared form action bars.

Why it exists:

- Avoids copying UI code between modules.
- Keeps module files focused on feature behavior.
- Provides consistent styling and accessibility across pages.

### `src/modules`

This is the feature layer. Each domain has its own API client, hooks, components, and types.

Typical module structure:

```text
modules/bookings
├── api
│   └── adminBookingsApi.ts
├── components
│   └── AdminBookingManager.tsx
├── hooks
│   └── useAdminBookings.ts
├── types
│   └── bookings.types.ts
└── index.ts
```

Why it exists:

- Keeps domain logic close together.
- Makes it easier to find all frontend code for a feature.
- Keeps shared components free of business-specific API logic.

### `src/lib`

This folder contains infrastructure code used across multiple modules.

Subfolders:

- `api`: generic API helpers and response parsing.
- `auth`: server session, auth context, route access, and cookie helpers.
- `cache`: query/cache helpers.
- `error`: frontend-safe error handling and maps.
- `security`: sanitization and rate limiting helpers.

Why it exists:

- Centralizes cross-cutting logic.
- Prevents every module from re-implementing auth, API, error, or security helpers.
- Keeps security-sensitive code easier to review.

### `src/constants`

This folder contains stable app constants.

Files:

- `config.ts`: runtime constants like request timeout.
- `routes.ts`: route constants used across the app.
- `permissions.ts`: role and route permission helpers.

Why it exists:

- Avoids magic strings scattered through components.
- Keeps route and permission labels consistent.

### `src/hooks`

This folder contains generic hooks that can be used by many modules.

Files:

- `useTheme.ts`: DOM-based theme switching through `data-theme` and local storage.
- `useRateLimit.ts`: lightweight client rate limiting.
- `usePermission.ts`: role permission helper.
- `usePagination.ts`: reusable pagination state.
- `useDebounce.ts`: debounced value helper.
- `useCachedQuery.ts`: small cached query helper.

Why it exists:

- Shared hooks belong outside a single domain module.
- Domain-specific hooks stay inside `src/modules/<domain>/hooks`.

### `src/styles`

This folder contains global token and theme CSS.

Files:

- `tokens.css`: base design tokens.
- `variables.css`: semantic and component CSS variables.
- `globals.css`: global CSS rules.

Why it exists:

- The app uses CSS custom properties instead of runtime CSS-in-JS.
- Theme changes happen through DOM attributes and CSS variables.
- Styling stays lightweight and predictable.

### `src/types`

This folder contains shared TypeScript types.

Files:

- `api.types.ts`: common API response shapes.
- `auth.types.ts`: app role and auth types.
- `common.types.ts`: generic shared types.

Why it exists:

- Shared contracts should not be duplicated in every module.
- Module-specific types stay inside their module.

## Important Root Files

### `src/proxy.ts`

Runs before protected route rendering.

Responsibilities:

- Read auth cookies.
- Refresh sessions when possible.
- Fetch `/auth/context`.
- Allow or deny dashboard routes.
- Redirect unauthenticated users to `/login`.
- Redirect forbidden users to `/unauthorized`.

### `src/app/layout.tsx`

Root app layout.

Responsibilities:

- Defines the HTML shell.
- Loads global styles.
- Sets metadata and document structure.

### `src/app/page.tsx`

Root route.

Responsibilities:

- Directs users to the correct initial screen.
- Works with auth/proxy behavior to land users in the right area.

### `src/app/(dashboard)/layout.tsx`

Protected dashboard layout.

Responsibilities:

- Calls `getServerAuthContext`.
- Redirects unauthenticated users.
- Blocks users without dashboard access.
- Renders `DashboardShell`.

### `src/app/(auth)/layout.tsx`

Auth pages layout.

Responsibilities:

- Provides the login/reset visual shell.
- Keeps auth pages separate from dashboard navigation.

## Data Fetching Pattern

The app uses three data-loading patterns:

1. Server-side auth context fetching for protected layouts and permission guards.
2. Client-side module hooks for interactive tables, filters, modals, and form submissions.
3. Small API client files for endpoint calls.

Example flow:

```text
Booking page
-> PermissionGuard checks route access
-> AdminBookingManager renders tabs
-> useAdminBookings builds filters
-> adminBookingsClient.list calls /admin/bookings
-> table renders result
-> mutation calls API
-> hook refreshes list after success
```

## API Client Pattern

Each module owns its API calls.

Rules:

- Use `authFetch` for authenticated API requests.
- Use `URLSearchParams` for query strings.
- Keep endpoint paths in the API file.
- Return typed response data, not raw fetch responses.
- Do not use Axios.
- Do not put business decisions in API clients.

Example:

```ts
const response = await authFetch<ApiResponse<AdminBookingListResult>>(
  `/admin/bookings?${query}`,
  { method: "GET" },
);

return response.data;
```

## Component Pattern

The app separates page, module, and shared UI responsibilities.

- Page files are thin.
- Module managers own feature state.
- Shared components own reusable presentation.
- Hooks own data loading and mutation state.
- API files own endpoint calls.

This keeps pages readable and prevents one large global state layer from controlling everything.

## Permission UI Pattern

The frontend follows a read/write split.

- If the user cannot read a page, show a lock panel.
- If the user can read but cannot write, show records without action buttons.
- If the user can write, show the relevant action buttons.
- Never trust hidden buttons as security. The backend must still reject forbidden actions.

Example:

```tsx
const canCancelBooking = permissions.includes("admin:bookings:cancel");

return canCancelBooking ? <button type="button">Cancel booking</button> : null;
```

## Security Practices

- Use server-side auth checks for protected routes.
- Use `/auth/context` as the frontend permission source.
- Avoid rendering raw HTML.
- Keep user data as React text values.
- Use `authFetch` so API calls include auth handling.
- Use AbortController-backed request timeouts where available.
- Do not expose tokens in logs or UI.
- Do not calculate backend-owned state such as payment settlement, wallet balance, booking capacity, or waitlist promotion.

## Performance Practices

- Keep page files server-rendered where possible.
- Use client components only for interactive screens.
- Keep module API clients lightweight.
- Avoid heavy component libraries.
- Avoid runtime CSS-in-JS.
- Use CSS variables and static CSS modules/utilities.
- Keep tables and filters simple and predictable.
- Use local module state instead of broad global state unless there is a real shared-state need.

## Scripts

Run from the repository root:

```bash
pnpm --filter @lafam/web dev
pnpm --filter @lafam/web lint
pnpm --filter @lafam/web typecheck
pnpm --filter @lafam/web build
```

Run from `apps/web`:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Environment

The frontend expects API configuration through environment variables.

Common variable:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Check `.env.example` for the current required values.

## Adding A New Page

1. Create the route under `src/app/(dashboard)/your-page/page.tsx`.
2. Add route permission mapping in `src/lib/auth/admin-access.ts`.
3. Add proxy route protection in `src/proxy.ts`.
4. Add a sidebar item in `components/layout/Sidebar/Sidebar.tsx` if it should appear in navigation.
5. Create a module under `src/modules/your-domain`.
6. Add `api`, `hooks`, `components`, `types`, and `index.ts`.
7. Keep the page file thin and render a module manager component.
8. Hide write actions unless the permission is present.
9. Run lint and typecheck.

## Adding A New Module

Use this structure:

```text
src/modules/example
├── api
│   └── exampleApi.ts
├── components
│   └── ExampleManager.tsx
├── hooks
│   └── useExample.ts
├── types
│   └── example.types.ts
└── index.ts
```

Module rules:

- Keep endpoint calls in `api`.
- Keep React state and load/mutate behavior in `hooks`.
- Keep UI workflows in `components`.
- Keep public exports in `index.ts`.
- Keep shared UI in `src/components`, not in the module.

## Current Route Summary

| Route                              | Purpose                            | Main Component                     | Access                    |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------- |
| `/login`                           | Sign in                            | Auth module login page             | Public/auth               |
| `/forgot-password`                 | Start reset                        | Auth module                        | Public/auth               |
| `/dashboard`                       | Admin dashboard                    | `AdminDashboard`                   | Admin dashboard           |
| `/bookings`                        | Booking, private booking, waitlist | `AdminBookingManager`              | `admin:bookings:read`     |
| `/calendar`                        | Booking calendar                   | `AdminCalendar`                    | `admin:bookings:calendar` |
| `/services/pilates`                | Pilates class list                 | `PilatesClassManager`              | Admin dashboard           |
| `/services/pilates/[classId]`      | Pilates class detail               | `PilatesClassDetailManager`        | Admin dashboard           |
| `/settings`                        | Profile and admin settings         | `ProfileSettings`, `AdminSettings` | `profile:read`            |
| `/settings/customers/[customerId]` | Customer detail                    | Customer detail page               | `admin:customers:read`    |
| `/staff`                           | Staff directory                    | `StaffDirectory`                   | Admin dashboard           |
| `/users`                           | User management                    | `AdminUserManager`                 | `admin:users:read`        |
| `/payments`                        | Payment management                 | `AdminPaymentManager`              | Admin dashboard           |
| `/wallet`                          | Wallet management                  | `AdminWalletManager`               | Admin dashboard           |
| `/unauthorized`                    | Locked route screen                | `AccessDeniedPanel`                | Public fallback           |

## Development Checklist

Before finishing frontend work:

- Confirm route access uses `/auth/context`.
- Confirm read-only users can view but not mutate.
- Confirm guests/customers cannot access dashboard routes.
- Confirm API calls use typed clients.
- Confirm no unsafe HTML rendering was added.
- Run `pnpm --filter @lafam/web lint`.
- Run `pnpm --filter @lafam/web typecheck`.



Task: Resolve Duplicate / Overlapping Files in LAFAM-Platform (apps/web)

Context

This codebase has several pairs of files that appear to implement the same responsibility in two places. This likely happened from incremental development (e.g., a custom hook was built before React Query was added, but the old one was never removed). Your job is to investigate each pair, determine the correct outcome, and leave the codebase with exactly one source of truth per responsibility.

Ground rules (apply to every pair below)


Read both files in full before deciding anything. Do not assume one is dead code just because it looks older or smaller.
For each pair, classify it as one of:

A) True duplicate — same logic/responsibility, no meaningful differences. Keep the better-written one (clearer code, better typed, actually used more widely), delete the other, and update every import across the repo to point at the survivor.
B) Same responsibility, different behavior — e.g., one has retry logic the other lacks, or one has a bug fix the other doesn't. Merge them into a single file that preserves every piece of correct, non-redundant behavior from both. Do not silently drop functionality — if you're unsure whether a difference is intentional, leave a // TODO: confirm intent comment rather than deleting it.
C) Actually different responsibilities that were just named/placed confusingly — keep both, but rename and/or relocate so the distinction is obvious from the filename/path alone (e.g., one is a low-level utility, the other is a React hook wrapping it).



After resolving a pair: search the entire src/ tree for every import of the deleted/renamed file and update them. Do not leave any broken imports.
Run the TypeScript compiler (tsc --noEmit) and the build after each pair is resolved, not just at the end — this makes it easy to isolate which change broke something if anything does.
Do not change unrelated code. Stay scoped to the duplication issue in each section. If you notice an unrelated bug while you're in a file, note it at the end of your summary instead of fixing it inline.
Preserve git history where reasonable — prefer git mv over delete+recreate when a file is just being renamed/relocated with no content changes, so blame history isn't lost.
After all pairs are resolved, run the full test suite (if one exists) and confirm the app still builds and starts cleanly.



Pair 1: Caching — hooks/useCachedQuery.ts vs lib/cache/queryClient.ts + lib/cache/QueryProvider.tsx

Investigate:


Is useCachedQuery a standalone cache (its own in-memory store, its own invalidation) or does it internally call useQuery from React Query?
Which modules actually import useCachedQuery vs which import React Query's useQuery directly?
Does useCachedQuery have any feature React Query's setup doesn't (e.g., a specific TTL pattern, a specific key-namespacing convention your team relies on)?


Resolve:


If useCachedQuery duplicates React Query's job with no unique behavior → delete it, migrate every consumer to call useQuery/useMutation directly (or through your module-level hooks like useAdminBookings), confirm QueryProvider wraps the app correctly in the root layout.
If useCachedQuery has a genuinely useful convention (e.g., standardized query keys, standardized error shape) that React Query's raw useQuery doesn't give you → keep it, but rewrite it as a thin wrapper around useQuery so there's only one actual cache underneath, not two. Document in a comment at the top of the file that this is intentionally a convenience wrapper, not a separate cache.
Either way, the end state must be: one cache, one invalidation strategy, used consistently across all modules.



Pair 2: Rate limiting — hooks/useRateLimit.ts vs lib/security/rateLimiter.ts

Investigate:


Does useRateLimit hold its own state (e.g., a useState/useRef counter) independent of rateLimiter.ts, or does it call into rateLimiter.ts?
Are they rate-limiting the same thing (e.g., login attempts) or different things (one for API calls generally, one for a specific form)?


Resolve:


If they track state independently, there's a real bug risk: one part of the UI could allow an action the other part should have blocked. Consolidate into a single source of truth in lib/security/rateLimiter.ts, and make useRateLimit a thin React hook that reads/writes through it.
If they're genuinely rate-limiting different, unrelated things, rename them so that's unambiguous (e.g., useFormSubmitRateLimit.ts) and document the distinction in each file's top comment.



Pair 3: Global styles — app/globals.css vs styles/globals.css

Investigate:


Check app/layout.tsx to see which one is actually imported.
Diff the two files' contents.


Resolve:


If the imported one is missing rules present in the other (unused) file, merge the missing rules in before deleting the unused file.
Delete whichever file is not imported anywhere.
Standardize going forward: all global CSS lives in one location (recommend styles/ since app/ should stay focused on routing/layout files). Update app/layout.tsx's import if the location changes.



Pair 4: Auth types — types/auth.types.ts vs modules/auth/types/auth.types.ts

Investigate:


Diff the type definitions in both files. Look specifically for the same type name (e.g., User, Session) defined differently in each — this is the dangerous case, since TypeScript won't warn you about it and code importing from one vs the other could silently disagree on a shape.


Resolve:


Cross-cutting types genuinely used outside the auth module (e.g., a basic User shape referenced by customers or staff modules) belong in root types/auth.types.ts.
Types only ever used inside modules/auth/** belong solely in modules/auth/types/auth.types.ts.
If the same type name currently has two different shapes, pick the correct/current one, fix every place using the stale shape, and add a short comment explaining the split (root = shared, module = internal) so this doesn't happen again.



Pair 5 (related, not strictly duplicate): Permission logic — constants/permissions.ts, hooks/usePermission.ts, components/guards/PermissionGuard.tsx

Investigate:


Does PermissionGuard.tsx contain its own permission-checking logic, or does it call usePermission?
Does usePermission read from constants/permissions.ts, or does it have its own hardcoded permission map?


Resolve:


There should be exactly one place permission rules are defined (constants/permissions.ts), exactly one place that checks "does this user have permission X" (usePermission), and the guard component should be a thin wrapper that calls the hook and renders conditionally. If PermissionGuard currently re-implements any checking logic, remove it and have it call usePermission instead.



Deliverable

After completing all five pairs, provide a short summary covering, for each pair: what you found (A/B/C classification from the rules above), what you changed, every file you deleted or renamed, and confirmation that tsc --noEmit and the build both pass with zero errors. Flag anything you were unsure about rather than guessing silently.