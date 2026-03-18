# Version History

## 1.6.0 - 2026-03-18

### API Route Alignment
- Renamed public room endpoints from `/api/hotels` to `/api/rooms` across frontend, backend, and API docs.
- Updated backend route registration and payment-intent limiter paths to the new `/api/rooms` namespace.
- Updated E2E guest-booking tests to reflect the new room API route.

### Search and Room Listing UX Refresh
- Redesigned search results page with a booking-details sidebar, date range picker, guest counters, sorting, and list/grid toggles.
- Reworked search result cards to support dedicated list and grid layouts with streamlined booking CTAs.

### Room Detail Layout Refresh
- Redesigned room detail page into a responsive two-column layout with gallery and room content on the left and booking widget on the right.
- Updated booking sidebar form styling while preserving existing booking logic and validation behavior.
- Refined responsive behavior and removed decorative sidebar image to keep focus on booking actions.

### Validation
- Verified TypeScript diagnostics for updated detail/search/booking components after layout and API route changes.

## 1.5.0 - 2026-03-17

### Booking Operations and Backoffice Management
- Added a complete booking operations module for admin/hotel-owner workflows.
- Added booking dashboard route and page (`/booking-dashboard`) with role-based access.
- Added booking details route and page (`/booking/:bookingId`) with editable guest fields and status-aware actions.
- Added booking decision flow (`confirm` / `reject`) with optional rejection reason handling.
- Added check-in route and page (`/hotel/:hotelId/check-in/:bookingId`) with guest arrival details, payment metadata, document uploads, and city-tax calculation.
- Added monthly booking management page (`/manage-bookings`) with calendar/table views and day-level controls.

### Vacancy Monitoring and Occupancy Optimization
- Added vacancy management page (`/vacancy-management`) and linked it from the dashboard vacancy card.
- Added clickable vacancy-rate card with occupancy-style visual treatment and redirect behavior.
- Added vacancy-focused date availability visualization to support marketing actions.
- Added marketing recommendation section for high-vacancy period targeting.
- Added sortable booking table columns in the booking dashboard for reference, guest, nationality, contact, stay dates, and guests.

### Backend API and Data Model Enhancements
- Added booking management endpoints for:
	- room listing (`/api/bookings/rooms`)
	- room calendar and day status
	- booking decisions (`/:id/decision`)
	- check-in submission (`/:id/check-in`)
	- booking dashboard summary (`/dashboard/summary`)
- Added `arrived` booking status support across models, validation, and frontend/backend flows.
- Added `BookingDayStatus` model for closed-day controls in management calendar.
- Added overlap-protection checks for conflicting bookings in hotel booking routes.
- Extended booking payloads with nationality/arrival metadata and check-in details.

### Notifications and Communications
- Extended contact/mail service with booking decision and check-in notification templates.
- Added decision notification emails (admin + guest) for confirm/reject actions.
- Added check-in notification email with guest/check-in metadata and document counts.
- Improved date formatting in outbound email templates.

### Cloudinary Removal and Storage Simplification
- Removed Cloudinary dependency and backend Cloudinary configuration requirements.
- Removed Cloudinary environment variables from deployment/config samples.
- Reworked upload handling to use direct data-URI/document storage flow.
- Updated project documentation references from Cloudinary to SharePoint/document flow where applicable.

### Frontend UX and Navigation Updates
- Added booking/admin entries to user menu and role-aware navigation.
- Updated booking flow forms and checkout with nationality support.
- Improved booking conflict messaging in checkout for overlapping reservations.
- Unified date rendering with shared friendly-date utility across analytics and booking surfaces.
- Added page-title mappings for newly introduced booking/vacancy/check-in routes.

### Tests, Seeds, and Data Adjustments
- Expanded e2e guest booking coverage with additional capacity/date-window scenarios.
- Updated duplicate protection test behavior to reflect overlap-based conflict logic.
- Adjusted seeded room child capacity for family-booking scenarios.

### Cleanup and Validation
- Removed confirmed unused frontend/backend modules (unused pages/components/models).
- Fixed booking details check-in navigation to target the defined check-in route structure.
- Verified frontend and backend production builds after integration.

## 1.4.0 - 2026-03-16

### End-User Booking Flow (First Fully Working Version)
- Implemented complete guest booking journey: `Detail` -> `Booking` -> `Checkout` without requiring sign-in.
- Replaced sign-in booking CTA with a direct progression CTA (`Proceed to your details`) using primary brand color.
- Added a dedicated checkout summary stage and final booking request submission step.
- Added Terms & Conditions page and linked consent references in booking flow.

### Booking Reliability and Safeguards
- Added backend-generated unique reservation numbers (`Booking Reference`) for each booking request.
- Included booking reference in both user-facing confirmation email and admin technical email.
- Added duplicate-request protection for repeated submissions within a time window (same guest/date window).
- Hardened server-side validation for guest booking requests (date order, capacity checks, server-side total calculation).
- Improved degraded behavior on email-delivery issues (booking remains saved, response includes warning).

### Contact Flow Hardening
- Added contact form draft persistence to reduce data loss on refresh/failure.
- Added inline contact submission error surface in addition to toast notifications.

### End-to-End Verification
- Added dedicated Playwright E2E for guest booking flow including homepage entry path.
- Added Playwright E2E for contact form flow and validation.
- Verified frontend and backend production builds locally.

## 1.3.0 - 2026-03-16

### Contact Form and Email Delivery
- Added a new `Contact Us` page and route (`/contact-us`) with validated form submission flow.
- Added backend `POST /api/contact` endpoint with input validation and Microsoft Graph mail delivery.
- Implemented dual-email behavior for contact requests: admin notification to inbox and confirmation email to the user.
- Added contact mail configuration options in backend environment examples and documentation.

### UX and Content Updates
- Added `Contact Us` links to desktop/mobile navigation and footer shortcuts.
- Updated contact UI to use WhatsApp icon/link for phone actions.
- Updated contact address to `Via Masaniello, 30 72100 Brindisi` with Google Maps linking.
- Added direct `Privacy Policy` link in contact consent text.

### Runtime and Config Improvements
- Added additional local CORS origins (`5175`, `5176`) for smoother development workflows.
- Updated deployment build version marker to `1.3.0`.

## 1.2.0 - 2026-03-15

### Privacy and Consent UX
- Added a dedicated `Privacy and Cookie Policy` page in the frontend.
- Added route-level page title support for the new privacy policy page.
- Linked cookie-consent footer actions to the internal privacy policy route.
- Added a footer shortcut link (`Privacy & Cookies`) for easier policy access.
- Improved cookie banner and preferences modal styling to match Palazzo Pinto branding.

### Deployment
- Updated deployment build version marker to `1.2.0`.

## 1.0.2 - 2026-03-15

### Cleanup and Branding
- Removed verified unused frontend and test example files to reduce maintenance overhead.
- Removed unused dependencies from frontend and backend package manifests.
- Rebranded project-facing docs and API labels from the generic hotel project name to `Palazzo Pinto B&B`.
- Updated frontend metadata and route-based page titles for consistent `Palazzo Pinto B&B` branding.
- Switched site favicon and social preview defaults to `hotel-booking-frontend/public/home/favicon.png`.

### Deployment
- Updated deployment build version marker to `1.0.2`.

## 1.0.1 - 2026-03-15

### Fixes
- Fixed single-property room visibility issue where persisted guest filters could hide `Fuocorosa`.
- Set default `childCount` fallback to `0` in frontend search context.
- Forced single-property mode search requests to use `adultCount=1` and `childCount=0` to avoid stale filter regressions.
- Updated deployment build version marker to `1.0.1`.

## 1.0 - 2026-03-15

### Release Highlights
- Configured the platform for single-property mode (Palazzo Pinto B&B).
- Applied Palazzo Pinto branding across the frontend (logo, naming, property-focused navigation).
- Simplified the user journey to a room-first booking experience.
- Seeded initial room data and media for Palazzo Pinto rooms.
- Refined room detail gallery UX with a prominent main image and thumbnail strip.

### Access Control and Authentication
- Added role-aware authorization on backend routes (`user`, `hotel_owner`, `admin`).
- Enforced owner/admin permissions for room and booking management endpoints.
- Added Microsoft Entra ID sign-in flow (backend endpoints + frontend callback handling).
- Switched to Microsoft-only authentication for sign-in.
- Disabled legacy email/password registration/login and direct Google auth endpoints.

### Frontend Role Awareness
- Added role-aware navigation and route protection in the frontend.
- Updated account/menu options for owner/admin workflows.

### Infrastructure and Stability
- Updated environment configuration for Entra credentials.
- Resolved stale-process issue causing `Cannot GET /api/auth/microsoft` and validated redirect flow.

### Notes
- This marks the baseline production candidate for Palazzo Pinto B&B.
