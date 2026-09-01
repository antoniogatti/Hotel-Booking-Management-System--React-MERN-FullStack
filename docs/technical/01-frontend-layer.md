# Palazzo Pinto B&B — Frontend Layer

## 1. Purpose
The frontend is the guest-facing and operator-facing web application. It is responsible for:
- navigation and page rendering
- search and room discovery
- booking journey and checkout
- sign-in and auth callback handling
- public policy pages
- owner/admin dashboards
- light client-side telemetry for public page views

## 2. Stack
From `hotel-booking-frontend/package.json` the frontend uses:
- **React 18**
- **TypeScript**
- **Vite**
- **React Router DOM**
- **React Query**
- **Axios**
- **Tailwind CSS**
- **Radix UI** and other component libraries

## 3. Routing model
`src/App.tsx` defines the app routes.

### Public routes
- `/` — home
- `/search` — search results
- `/rooms` — room catalogue in single-property mode
- `/detail/:hotelId` — room/property detail
- `/rooms/:roomSlug` — branded room landing page
- `/booking/...` and `/hotel/...` booking/check-in paths
- `/contact-us`
- `/reach-us`
- `/our-recommendations`
- `/privacy-cookie-policy`
- `/terms-conditions`
- `/self-checkin`
- `/sign-in`
- `/auth/callback`

### Protected operator routes
- `/api-docs`
- `/api-status`
- `/my-hotels`
- `/booking-dashboard`
- `/admin-portal`
- `/admin-portal/check-in`
- `/admin-portal/self-checkins`
- `/booking-com-sync`
- `/scheduler-monitor`
- `/traffic-insights`
- `/manage-bookings`
- `/vacancy-management`
- `/add-hotel`
- `/edit-hotel/:hotelId`

## 4. Page composition
The app uses a layered shell:
- `Layout` for the public/product experience
- `AuthLayout` for sign-in related screens
- `ScrollToTop` for navigation cleanup
- `Toaster` for user feedback

The page title is updated dynamically from the route, and public page views are tracked in the backend.

## 5. Data access pattern
The frontend talks to the backend through `src/lib/api-client.ts` and `src/api-client.ts`.

Common patterns:
- `axiosInstance` for API calls
- `validateToken()` for session validation
- `signIn()` / `signOut()` flows
- local storage for session/user display state
- `React Query` for cached data and refetches

## 6. Current auth behaviour
The current implementation uses a token-based client flow:
- sign-in stores a session token locally
- the app validates it against `/api/auth/validate-token`
- user profile fields are cached in browser storage for UI use

This is important for understanding the existing UI flow and for future hardening work.

## 7. Main feature groups
### Guest features
- hotel search and filtering
- room detail pages
- booking flow
- checkout
- contact pages
- self check-in
- policies and recommendations

### Operator features
- property management
- booking management
- booking dashboard
- analytics / traffic insights
- admin portal
- Booking.com sync admin page
- scheduler monitor

## 8. Files worth reading next
- `src/App.tsx`
- `src/api-client.ts`
- `src/lib/api-client.ts`
- `src/contexts/AppContext.tsx`
- `src/pages/Home.tsx`
- `src/pages/Booking.tsx`
- `src/pages/BookingDashboard.tsx`
- `src/pages/AdminPortal.tsx`

## 9. Practical takeaway
The frontend is not just a brochure site: it is the public booking surface plus the operator console entry point.
