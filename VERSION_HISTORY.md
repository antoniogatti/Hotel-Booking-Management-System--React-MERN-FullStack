# Version History

## 1.10.0 - 2026-04-15

### Admin Mobile Reliability and Navigation
- Replaced the mobile admin drawer implementation to remove the interaction issues that blocked taps on mobile devices.
- Redesigned the mobile admin menu with an inline second level for admin tools and API links.
- Fixed admin portal `Update Booking` actions so they open the booking details page directly instead of sending users to the check-in flow.

### Front-Desk and Check-In UX
- Reworked the Check-In Desk into a responsive mobile-first layout with card-based rows on small screens and the full table on larger screens.
- Removed the editable `Room Total` field from the guest check-in form and now rely on the stored booking total for payment summary calculations.
- Made the guest check-in page mobile-first with clearer card layout, stacked actions, and less cramped document and form sections.

### OneNote-Enriched Check-In Details
- Added a collapsed `OneNote Details` card after the booking summary on the guest check-in page.
- Prefill arrival time, nationality, booking channel, payment details, and phone from synced OneNote and Excel metadata when available.

## 1.9.0 - 2026-04-10

### Booking Operations and Excel Sync
- Added a dedicated booking update flow for both direct bookings and imported Booking.com bookings, including editable guest/contact fields and guest-count updates on the booking details page.
- Added manual Excel enrichment support for imported bookings, including traceable matched-row metadata, visible sync feedback, and overwrite warnings when Excel totals replace stored values.
- Added direct WhatsApp launch from booking details when a guest phone number is present.

### Front-Desk and Dashboard Improvements
- Updated the admin portal front-desk actions so `Update Booking` opens the booking details page with Excel sync instead of the check-in form.
- Extended the booking dashboard summary to include imported Booking.com stays in counts, occupancy, nationality stats, and detail rows.
- Added room and nights columns to the booking dashboard details table to make occupancy calculations easier to verify.
- Added a `Dashboard` navigation link for owner/admin users and removed the obsolete front-desk focus info card from the admin portal.

### UI and Currency Consistency
- Standardized visible currency formatting to euro presentation across booking, checkout, analytics, check-in, management, and policy pages.
- Updated booking details navigation so the back action follows browser history with a dashboard fallback.

## 1.8.6 - 2026-04-09

### Local Recommendations Guide
- Added a new public "Our Recommendations" page with curated restaurants, Brindisi landmarks, beaches, Valle d'Itria stops, and Salento day-trip ideas.
- Linked the new guide from the main navigation, mobile navigation, and footer so guests can reach it from anywhere on the site.
- Added lightweight category and distance filtering plus proximity-based sorting across all recommendation sections.

## 1.8.5 - 2026-04-08

### Frontend Bootstrap Fix
- Fixed a React runtime initialization failure that left the frontend on a white screen in local and production builds.
- Moved the shared React Query client out of the frontend bootstrap entrypoint to remove a circular import between `main.tsx`, `App.tsx`, and the API client.

## 1.8.4 - 2026-04-08

### Production Authentication Recovery
- Added a bearer-token fallback to the Microsoft OAuth callback so production sign-in can complete even when browsers do not preserve the cross-site session cookie between the frontend and backend Azure Web App hosts.
- Persisted the issued session token in the frontend auth callback and attached it automatically to authenticated API requests for token validation and protected admin flows.

## 1.8.3 - 2026-04-08

### Azure Production Hardening
- Normalized proxied client IP values before `express-rate-limit` key generation so Azure App Service requests with `IP:port` no longer trigger invalid IP validation errors.
- Added a local ambient declaration for the optional `mongodb-memory-server` dev dependency so TypeScript builds remain stable in pruned deployment-style environments.

## 1.8.2 - 2026-04-08

### Production Stability
- Fixed the backend startup path so the local-only `mongodb-memory-server` fallback is loaded lazily and no longer crashes Azure App Service production instances.

## 1.8.1 - 2026-04-08

### Local Development Stability
- Added an opt-in in-memory MongoDB fallback for local backend development when the configured cloud database is unavailable.
- Updated local Microsoft sign-in behavior in the in-memory development environment so the profile menu exposes the expected admin surfaces during testing.

### Profile Experience
- Set the signed-in avatar fallback to the local `immagineprofilo.png` asset instead of the generated Robohash placeholder.

## 1.8.0 - 2026-04-08

### Security and Authentication Hardening
- Moved browser authentication to secure cookie validation, added OAuth state verification, and stabilized the frontend auth callback flow.
- Restricted admin-only frontend surfaces and removed public business-insights access from the active application flow.
- Added structured backend logging, upload validation, and broader audit coverage for hotel, booking, and check-in mutations.

### Booking Flow Simplification
- Removed Stripe-based payment handling and finalized the booking-request-only model across frontend, backend, shared types, tests, and documentation.
- Removed legacy payment fields and UI remnants from booking management views and backend booking storage.

### Azure Rollout Preparation
- Added production Bicep and rollout artifacts for the secure backend, Key Vault, monitoring, and Static Web Apps transition path.
- Added persisted-role assignment tooling and production role manifests for explicit admin setup.
- Reduced rollout-script inputs by auto-discovering non-secret Azure values from the active subscription and existing resource group.

## 1.7.1 - 2026-04-07

### Homepage Staff Section
- Added a new "Our Staff" section to the home page with real staff photos for Maurizio, Anna, Lucia, and Antonio.
- Simplified the presentation into responsive horizontal cards with photo, name, and short description.
- Refined the staff copy to better match the Palazzo Pinto tone and updated the deployment build version marker to `1.7.1`.

## 1.7.0 - 2026-04-06

### Booking.com Calendar Sync
- Added Booking.com iCal import support with room-level configuration, manual sync, and recurring background sync.
- Added Booking.com external event storage and availability blocking so imported dates appear in admin calendars and prevent overlapping local bookings.
- Added tokenized local iCal export feeds so Booking.com can pull local closures and reservations without re-import loops.
- Added a dedicated Booking.com Sync admin panel for import URLs, export URL generation, token regeneration, and copy/paste workflow.

### Booking Management UX
- Redesigned the booking management calendar to use Booking.com-style horizontal stay bars across weekly rows.
- Added imported Booking.com entries to day details and table views.
- Greyed out past dates and highlighted today with a red border for faster calendar scanning.

### Data Integrity
- Fixed Booking.com DATE-only iCal normalization so imported stays align with the exact source date ranges.

### Deployment
- Updated deployment build version marker to `1.7.0`.

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
