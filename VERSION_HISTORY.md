# Version History

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
